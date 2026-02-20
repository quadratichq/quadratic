use std::collections::HashSet;
use std::sync::Arc;

use anyhow::Result;
use futures::future::join_all;
use k8s_openapi::api::batch::v1::Job;
use kube::{
    ResourceExt,
    api::{Api, DeleteParams, ListParams, PostParams},
};
use quadratic_rust_shared::quadratic_cloud::GetWorkerInitDataResponse;
use quadratic_rust_shared::storage::Storage;
use tracing::{error, info};
use uuid::Uuid;

use crate::quadratic_api::file_init_data;
use crate::state::State;

pub(crate) struct Controller {
    pub(crate) state: Arc<State>,
}

impl Controller {
    pub(crate) async fn new(state: Arc<State>) -> Result<Self> {
        Ok(Self { state })
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

        // Filter file IDs to only include those that have tasks in PubSub
        // This prevents us from creating workers for files with no tasks
        info!("[ensure_workers_exist] Checking which files have pending tasks in PubSub");
        let file_checks = missing_workers.iter().map(|file_id| async {
            let has_tasks = self.state.file_has_tasks(*file_id).await.unwrap_or(false);
            (*file_id, has_tasks)
        });
        let check_results = join_all(file_checks).await;

        let files_with_tasks: Vec<_> = check_results
            .into_iter()
            .filter_map(|(file_id, has_tasks)| if has_tasks { Some(file_id) } else { None })
            .collect();

        let files_without_tasks_count = missing_workers.len() - files_with_tasks.len();

        if files_without_tasks_count > 0 {
            info!(
                "[ensure_workers_exist] {} file(s) have no pending tasks, skipping worker creation for them",
                files_without_tasks_count
            );
        }

        if files_with_tasks.is_empty() {
            info!("[ensure_workers_exist] No files with pending tasks to create workers for");
            return Ok(());
        }

        info!(
            "[ensure_workers_exist] Found {} files that are missing file workers, creating them",
            files_with_tasks.len()
        );

        let futures = files_with_tasks
            .iter()
            .map(|file_id| self.create_worker(file_id));

        let results = join_all(futures).await;

        for (file_id, result) in files_with_tasks.into_iter().zip(results) {
            if let Err(e) = result {
                error!("[ensure_workers_exist] Failed to create file worker for {file_id}: {e}");
            }
        }

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
                && status.active.unwrap_or(0) > 0
                && let Some(labels) = &job.metadata.labels
                && let Some(file_id_str) = labels.get("file-id")
                && let Ok(file_id) = Uuid::parse_str(file_id_str)
            {
                active_file_ids.insert(file_id);
            }
        }
        Ok(active_file_ids)
    }

    async fn file_has_active_worker(&self, file_id: &Uuid) -> Result<bool> {
        info!("[file_has_active_worker] Checking if file {file_id} has an active worker");
        let jobs = Self::get_namespaced_jobs(&self.state);
        let list_params = Self::get_list_params_for_worker_with_file_id(file_id);
        let job_list = jobs.list(&list_params).await?;
        match job_list
            .items
            .iter()
            .any(|job| job.metadata.deletion_timestamp.is_none())
        {
            true => {
                info!("[file_has_active_worker] Found file worker for file {file_id}");
                Ok(true)
            }
            false => {
                info!("[file_has_active_worker] No active worker found for file {file_id}");
                Ok(false)
            }
        }
    }

    async fn get_worker_init_data(&self, file_id: &Uuid) -> Result<GetWorkerInitDataResponse> {
        let mut file_init_data = file_init_data(&self.state, *file_id).await?;

        file_init_data.presigned_url = self
            .state
            .settings
            .files_presigned_url(&file_init_data.presigned_url)?
            .to_string();

        // Generate the thumbnail upload presigned URL directly from S3/storage
        let thumbnail_key = format!("{file_id}-thumbnail.png");
        let thumbnail_upload_url = self
            .state
            .settings
            .storage
            .presigned_upload_url(&thumbnail_key, "image/png")
            .await?;

        // For filesystem storage, rewrite the URL to point to the files service
        let thumbnail_upload_url = self
            .state
            .settings
            .files_presigned_url(&thumbnail_upload_url)?
            .to_string();

        let worker_init_data = GetWorkerInitDataResponse {
            team_id: file_init_data.team_id,
            email: file_init_data.email,
            sequence_number: file_init_data.sequence_number,
            presigned_url: file_init_data.presigned_url,
            thumbnail_upload_url,
            thumbnail_key,
            timezone: file_init_data.timezone,
        };

        Ok(worker_init_data)
    }

    async fn create_worker(&self, file_id: &Uuid) -> Result<()> {
        info!("[create_worker] Creating worker for file {file_id}");

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
        let worker_ephemeral_token = self.state.generate_worker_ephemeral_token(file_id).await;
        let worker_init_data = self.get_worker_init_data(file_id).await?;
        let timezone = worker_init_data.timezone.unwrap_or("UTC".to_string());
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
  ttlSecondsAfterFinished: 30
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
      serviceAccountName: quadratic-cloud-worker
      automountServiceAccountToken: false
      nodeSelector:
        quadratic.io/node-role: worker
      tolerations:
      - key: "quadratic.io/dedicated"
        operator: "Equal"
        value: "worker"
        effect: "NoSchedule"
      containers:
      - name: worker
        image: localhost:5001/quadratic-cloud-worker:latest
        imagePullPolicy: Always
        securityContext:
          privileged: true
        env:
        - name: RUST_LOG
          value: "info,worker=debug"
        - name: CONTROLLER_URL
          value: "http://quadratic-cloud-controller-worker:3005"
        - name: CONNECTION_URL
          value: "http://localhost:3003"
        - name: FILE_ID
          value: "{file_id}"
        - name: WORKER_EPHEMERAL_TOKEN
          value: "{worker_ephemeral_token}"
        - name: LOCALHOST_TUNNEL_PORTS
          value: "8000,3001,3002,3003"
        - name: TZ
          value: "{timezone}"
        resources:
          requests:
            cpu: 500m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 8Gi
        volumeMounts:
        - name: ready
          mountPath: /ready
        command: ["/bin/sh"]
        args:
        - -lc
        - |
          set -e

          # Set up localhost tunnel ports
          PORTS=$(echo "$LOCALHOST_TUNNEL_PORTS" | tr ',' ' ')
          echo "Waiting for localhost-tunnel readiness..."
          until [ -f /ready/localhost-tunnel.ready ]; do sleep 0.2; done
          echo "Verifying localhost ports..."
          for p in $PORTS; do
            until curl -sS --max-time 1 "http://localhost:$p/" -o /dev/null; do sleep 0.2; done
          done

          echo "Starting quadratic-cloud-worker with entrypoint..."
          exec ./entrypoint.sh
      - name: localhost-tunnel
        image: alpine:latest
        env:
        - name: LOCALHOST_TUNNEL_PORTS
          value: "8000,3001,3002,3003"
        - name: LOCALHOST_TUNNEL_SERVICE
          value: "quadratic-localhost-tunnel.{namespace}.svc.cluster.local"
        resources:
          requests:
            cpu: 50m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
        volumeMounts:
        - name: ready
          mountPath: /ready
        command: ["/bin/sh"]
        args:
        - -lc
        - |
          set -e
          apk add --no-cache socat netcat-openbsd
          PORTS=$(echo "$LOCALHOST_TUNNEL_PORTS" | tr ',' ' ')
          echo "Starting IPv4 forwarders to $LOCALHOST_TUNNEL_SERVICE for: $PORTS"
          for p in $PORTS; do
            socat -d -d TCP-LISTEN:$p,bind=127.0.0.1,fork,reuseaddr \
                  TCP:$LOCALHOST_TUNNEL_SERVICE:$p,forever,interval=1 &
          done
          echo "Waiting for ktunnel service reachability and local listeners..."
          for p in $PORTS; do
            until nc -z -w 1 "$LOCALHOST_TUNNEL_SERVICE" $p; do sleep 0.5; done
            until nc -z -w 1 127.0.0.1 $p; do sleep 0.2; done
          done
          echo ready >/ready/localhost-tunnel.ready
          echo "All ports ready."
          wait
      volumes:
      - name: ready
        emptyDir: {{}}
"#,
        );
        let job: Job = serde_yaml::from_str(&job_yaml)?;
        Ok(job)
    }

    pub(crate) async fn shutdown_worker(state: &Arc<State>, file_id: &Uuid) -> Result<()> {
        info!("[shutdown_worker] Shutting down worker for file {file_id}");
        let jobs = Self::get_namespaced_jobs(state);
        let list_params = Self::get_list_params_for_worker_with_file_id(file_id);
        let job_list = jobs.list(&list_params).await?;
        for job in job_list.items {
            if job.metadata.deletion_timestamp.is_none()
                && let Some(name) = job.metadata.name
            {
                info!("[shutdown_worker] Deleting worker job: {}", name);
                let delete_params = DeleteParams::default();
                match jobs.delete(&name, &delete_params).await {
                    Ok(_) => info!("[shutdown_worker] Successfully deleted worker job: {name}"),
                    Err(e) => {
                        error!("[shutdown_worker] Failed to delete worker job {name}: {e}");
                        return Err(anyhow::anyhow!(e));
                    }
                }
            }
        }
        Ok(())
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
