use quadratic_rust_shared::storage::{
    StorageContainer,
    file_system::{FileSystem, FileSystemConfig},
};

pub fn get_file_config() -> (String, String, String, String) {
    dotenv::from_filename("../quadratic-files/.env").ok();
    let host = std::env::var("HOST").unwrap();
    let port = std::env::var("PORT").unwrap();
    let storage_dir = std::env::var("STORAGE_DIR").unwrap();
    let encryption_keys = std::env::var("STORAGE_ENCRYPTION_KEYS").unwrap();
    (host, port, storage_dir, encryption_keys)
}

pub(crate) fn new_storage() -> StorageContainer {
    let (host, port, storage_dir, encryption_keys) = get_file_config();
    let encryption_keys = encryption_keys.split(",").map(|s| s.to_string()).collect();

    StorageContainer::FileSystem(FileSystem::new(FileSystemConfig {
        path: storage_dir,
        encryption_keys,
        presigned_url_base: format!("http://{host}:{port}/storage/presigned"),
    }))
}

// pub(crate) async fn setup() -> Arc<Mutex<Worker>> {
//     let worker = Worker {
//         file_id: Uuid::new_v4(),
//         sequence_num: 0,
//         session_id: Uuid::new_v4(),
//         file: Arc::new(Mutex::new(GridController::test())),
//         jwt: "M2M_AUTH_TOKEN".to_string(),
//         transaction_id: Arc::new(Mutex::new(None)),
//         websocket_sender: None,
//         websocket_receiver: None,
//         websocket_receiver_handle: None,
//         status: Arc::new(Mutex::new(WorkerStatus::new())),
//     };
//     let worker = Arc::new(Mutex::new(worker));

//     worker
// }
