use std::collections::HashSet;
use std::sync::Arc;

use anyhow::Result;
use futures::future::join_all;
use k8s_openapi::api::batch::v1::Job;
use kube::{
    ResourceExt,
    api::{Api, ListParams, PostParams},
};
use tracing::{error, info};
use uuid::Uuid;

use crate::state::State;

const BLOCKING_LISTENER_MAX_MESSAGES: usize = 5;
const BLOCKING_LISTENER_BLOCK_MS: usize = 5000;

pub(crate) struct Controller {
    pub(crate) state: Arc<State>,
}

impl Controller {
    pub(crate) async fn new(state: Arc<State>) -> Result<Self> {
        Ok(Self { state })
    }

    pub(crate) async fn listen_for_worker_task_events(&self) -> Result<()> {
        info!("[listen_for_worker_task_events] Subscribing to pubsub listener");

        self.state.subscribe_pubsub_blocking_listener().await?;

        loop {
            // Block and wait for new tasks in the blocking listener channel for active channel
            let messages = match self
                .state
                .get_tasks_from_pubsub_blocking_listener(
                    BLOCKING_LISTENER_MAX_MESSAGES,
                    BLOCKING_LISTENER_BLOCK_MS,
                )
                .await
            {
                Ok(messages) => messages,
                Err(e) => {
                    error!("Error getting messages: {e}");
                    continue;
                }
            };

            // get the file ids from the messages
            let file_ids = messages
                .into_iter()
                .flat_map(|(_, file_id)| match String::from_utf8(file_id) {
                    Ok(file_id) => Uuid::parse_str(&file_id).ok(),
                    Err(e) => {
                        error!("[listen_for_worker_task_events] Error parsing file id, error: {e}");
                        None
                    }
                })
                .collect::<HashSet<_>>();

            // ensure workers exist for the file ids
            for file_id in file_ids {
                if let Err(e) = self.ensure_worker_exists_if_needed_for_file(&file_id).await {
                    error!("Failed to handle scheduled task event, file_id: {file_id}, error: {e}");
                }
            }
        }
    }

    pub(crate) async fn scan_and_ensure_all_workers(&self) -> Result<()> {
        info!("[scan_and_ensure_all_workers] Scanning and ensuring all workers exist");

        let file_ids_needing_workers = self.state.get_file_ids_to_process().await?;

        info!(
            "[scan_and_ensure_all_workers] Found {} unique files with pending tasks",
            file_ids_needing_workers.len(),
        );

        self.ensure_workers_exist(file_ids_needing_workers).await?;

        Ok(())
    }

    async fn ensure_workers_exist(&self, file_ids: HashSet<Uuid>) -> Result<()> {
        info!(
            "[ensure_workers_exist] Ensuring workers exist for {} files",
            file_ids.len()
        );

        if file_ids.is_empty() {
            info!("[ensure_workers_exist] No files to ensure workers exist for, skipping");
            return Ok(());
        }

        let active_worker_file_ids = self.get_all_active_worker_file_ids().await?;

        info!(
            "[ensure_workers_exist] Found {} active file workers",
            active_worker_file_ids.len(),
        );

        let missing_workers = file_ids
            .into_iter()
            .filter(|file_id| !active_worker_file_ids.contains(file_id))
            .collect::<Vec<_>>();

        if missing_workers.is_empty() {
            info!("[ensure_workers_exist] No files are missing file workers, skipping");
            return Ok(());
        }

        info!(
            "[ensure_workers_exist] Found {} files that are missing file workers, creating them",
            missing_workers.len()
        );

        let futures = missing_workers
            .iter()
            .map(|file_id| self.create_worker(file_id));

        let results = join_all(futures).await;

        for (file_id, result) in missing_workers.into_iter().zip(results) {
            if let Err(e) = result {
                error!("[ensure_workers_exist] Failed to create file worker for {file_id}: {e}");
            }
        }

        Ok(())
    }

    async fn ensure_worker_exists_if_needed_for_file(&self, file_id: &Uuid) -> Result<()> {
        info!("Ensuring worker exists for file {file_id}");

        if self.file_has_active_worker(file_id).await? {
            info!("Active file worker found for file {file_id}");
            return Ok(());
        }

        info!("Checking if file {file_id} has pending tasks");
        if !self.state.file_has_pending_tasks(file_id).await? {
            info!("File {file_id} has no pending tasks, skipping worker creation");
            return Ok(());
        }

        self.create_worker(file_id).await?;

        Ok(())
    }

    async fn get_all_active_worker_file_ids(&self) -> Result<HashSet<Uuid>> {
        let jobs = Self::get_namespaced_jobs(&self.state);
        let list_params = Self::get_list_params_for_all_workers();
        let job_list = jobs.list(&list_params).await?;
        let mut active_file_ids = HashSet::new();
        for job in job_list.items {
            if job.metadata.deletion_timestamp.is_none()
                && let Some(status) = &job.status
            {
                if status.active.unwrap_or(0) > 0 {
                    if let Some(labels) = &job.metadata.labels {
                        if let Some(file_id_str) = labels.get("file-id") {
                            if let Ok(file_id) = Uuid::parse_str(file_id_str) {
                                active_file_ids.insert(file_id);
                            }
                        }
                    }
                }
            }
        }
        Ok(active_file_ids)
    }

    async fn file_has_active_worker(&self, file_id: &Uuid) -> Result<bool> {
        info!("Checking if file {file_id} has an active worker");

        let jobs = Self::get_namespaced_jobs(&self.state);
        let list_params = Self::get_list_params_for_worker_with_file_id(file_id);
        let job_list = jobs.list(&list_params).await?;
        match job_list
            .items
            .iter()
            .any(|job| job.metadata.deletion_timestamp.is_none())
        {
            true => {
                info!("Found file worker for file {file_id}");
                return Ok(true);
            }
            false => {
                info!("No active worker found for file {file_id}");
                return Ok(false);
            }
        }
    }

    async fn create_worker(&self, file_id: &Uuid) -> Result<()> {
        info!("Creating worker for file {file_id}");

        // Check if the file has an active worker
        if self.file_has_active_worker(file_id).await? {
            info!("File worker exists after lock for file {file_id}");
            self.state.release_worker_create_lock(file_id).await;
            return Ok(());
        }

        // Acquire the worker create lock
        let acquired = self.state.acquire_worker_create_lock(file_id).await;
        if !acquired {
            info!("Worker creation lock held for file {file_id}");
            return Ok(());
        }

        // Build the worker spec
        let job = match self.build_worker_spec(file_id).await {
            Ok(job) => job,
            Err(e) => {
                let error_message = format!("Failed to build worker spec: {e}");
                error!("{error_message}");
                self.state.release_worker_create_lock(file_id).await;
                return Err(anyhow::anyhow!(error_message));
            }
        };

        // Create the worker job
        let jobs = Self::get_namespaced_jobs(&self.state);
        match jobs.create(&PostParams::default(), &job).await {
            Ok(created_job) => {
                let worker_name = created_job.name_any();
                info!("Created file worker job {worker_name} for file {file_id}");
                self.state.release_worker_create_lock(file_id).await;
                Ok(())
            }
            Err(e) => {
                let error_message = format!("Failed to create file worker: {e}");
                error!("{error_message}");
                self.state.release_worker_create_lock(file_id).await;
                Err(anyhow::anyhow!(error_message))
            }
        }
    }

    async fn build_worker_spec(&self, file_id: &Uuid) -> Result<Job> {
        let namespace = self.state.settings.namespace.as_str();
        let worker_token = self.state.generate_worker_token(file_id).await;
        let job_yaml = format!(
            r#"
apiVersion: batch/v1
kind: Job
metadata:
  generateName: worker-{file_id}-
  namespace: {namespace}
  labels:
    app: worker
    file-id: "{file_id}"
    managed-by: quadratic-cloud-controller
spec:
  ttlSecondsAfterFinished: 300
  backoffLimit: 0
  activeDeadlineSeconds: 3600
  template:
    metadata:
      labels:
        app: worker
        file-id: "{file_id}"
        managed-by: quadratic-cloud-controller
        app.kubernetes.io/name: quadratic-cloud-worker
        app.kubernetes.io/component: worker
        app.kubernetes.io/part-of: quadratic-cloud
        app.kubernetes.io/managed-by: quadratic-cloud-controller
    spec:
      restartPolicy: Never
      containers:
      - name: worker
        image: localhost:5001/quadratic-cloud-worker:latest
        imagePullPolicy: IfNotPresent
        env:
        - name: RUST_LOG
          value: "info,worker=debug"
        - name: CONTROLLER_URL
          value: "http://quadratic-cloud-controller:3004"
        - name: FILE_ID
          value: "{file_id}"
        - name: WORKER_TOKEN
          value: "{worker_token}"
        resources:
          requests:
            cpu: 500m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 8Gi
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {{}}
"#
        );
        let job: Job = serde_yaml::from_str(&job_yaml)?;
        Ok(job)
    }

    pub(crate) async fn count_active_workers(&self) -> Result<usize> {
        let jobs = Self::get_namespaced_jobs(&self.state);
        let list_params = Self::get_list_params_for_active_workers();
        let job_list = jobs.list(&list_params).await?;
        Ok(job_list.items.len())
    }

    fn get_namespaced_jobs(state: &Arc<State>) -> Api<Job> {
        Api::namespaced(state.kube_client.clone(), &state.settings.namespace)
    }

    fn get_list_params_for_all_workers() -> ListParams {
        ListParams::default().labels("app=worker,managed-by=quadratic-cloud-controller")
    }

    fn get_list_params_for_active_workers() -> ListParams {
        Self::get_list_params_for_all_workers().fields("status.active=1")
    }

    fn get_list_params_for_worker_with_file_id(file_id: &Uuid) -> ListParams {
        Self::get_list_params_for_all_workers().labels(&format!("file-id={file_id}"))
    }
}
