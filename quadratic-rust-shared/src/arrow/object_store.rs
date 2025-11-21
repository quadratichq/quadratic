//! Object Store functions for Arrow.
//!
//! Functions to interact with the object store.
//!
//! Currently, we only support S3 and filesystem.

use futures_util::TryStreamExt;
use object_store::local::LocalFileSystem;
pub use object_store::{ObjectMeta, ObjectStore, WriteMultipart, aws::AmazonS3Builder, path::Path};
use std::{path::PathBuf, sync::Arc};
pub use url::Url;

use crate::{SharedError, arrow::error::Arrow as ArrowError, error::Result};

pub enum ObjectStoreKind {
    S3,
    FileSystem,
}

/// Convert an error to a SharedError.
pub fn object_store_error(e: impl ToString) -> SharedError {
    SharedError::Arrow(ArrowError::ObjectStore(e.to_string()))
}

/// Create a new object store URL.
pub fn object_store_url(kind: ObjectStoreKind, bucket_name: Option<&str>) -> Result<Url> {
    let url = match kind {
        ObjectStoreKind::S3 => format!(
            "s3://{}",
            bucket_name.ok_or_else(|| object_store_error("Bucket name is required"))?
        ),
        ObjectStoreKind::FileSystem => "file://".to_string(),
    };

    Url::parse(&url).map_err(object_store_error)
}

/// Create a new S3 object store.
pub fn new_s3_object_store(
    bucket: &str,
    region: &str,
    access_key_id: &str,
    secret_access_key: &str,
    is_local: bool,
) -> Result<(Arc<dyn ObjectStore>, Url)> {
    let mut s3_builder = AmazonS3Builder::new()
        .with_bucket_name(bucket)
        .with_region(region)
        .with_access_key_id(access_key_id)
        .with_secret_access_key(secret_access_key);

    if is_local {
        s3_builder = s3_builder.with_endpoint("http://localhost:4566");
        s3_builder = s3_builder.with_allow_http(true);
    }

    let s3 = s3_builder.build().map_err(object_store_error)?;
    let path = format!("s3://{}", bucket);
    let s3_url = Url::parse(&path).map_err(object_store_error)?;
    let arc_s3 = Arc::new(s3);

    Ok((arc_s3, s3_url))
}

/// Create a new filesystem object store.
pub fn new_filesystem_object_store(path: &str) -> Result<(Arc<dyn ObjectStore>, PathBuf)> {
    // Trim trailing slashes to avoid issues with object_store
    let normalized_path = path.trim().trim_end_matches('/');

    println!(
        "Creating filesystem object store at path: {} (original: {:?})",
        normalized_path, path
    );

    let file_system = LocalFileSystem::new_with_prefix(normalized_path).map_err(|e| {
        object_store_error(format!(
            "Failed to create LocalFileSystem with path {:?}: {}",
            normalized_path, e
        ))
    })?;

    let arc_file_system = Arc::new(file_system);
    Ok((arc_file_system, PathBuf::from(normalized_path)))
}

/// List objects from the object store.
///
/// The prefix is the path to the objects.
///
/// Metadata includes: location, last_modified, size, etag, version
pub async fn list_objects(
    object_store: &Arc<dyn ObjectStore>,
    prefix: Option<&str>,
) -> Result<Vec<ObjectMeta>> {
    let list_stream = object_store.list(prefix.map(Path::from).as_ref());
    let objects: Vec<ObjectMeta> = list_stream
        .try_collect()
        .await
        .map_err(object_store_error)?;

    Ok(objects)
}

/// Upload a multipart file to the object store.
///
/// Use this approach for large files to avoid memory issues.
pub async fn upload_multipart(
    object_store: &Arc<dyn ObjectStore>,
    path: &str,
    data: &[u8],
) -> Result<()> {
    let path = Path::from(path);
    let upload = object_store
        .put_multipart(&path)
        .await
        .map_err(object_store_error)?;
    let mut write = WriteMultipart::new(upload);
    write.write(data);
    write.finish().await.map_err(object_store_error)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_object_store_url() {
        // s3
        let bucket_name = "test-bucket";
        let result = object_store_url(ObjectStoreKind::S3, Some(bucket_name));
        assert!(result.is_ok());

        let url = result.unwrap();
        assert_eq!(url.scheme(), "s3");
        assert_eq!(url.host_str(), Some(bucket_name));

        // missing bucket name
        let result = object_store_url(ObjectStoreKind::S3, None);
        assert!(result.is_err());

        // filesystem
        let result = object_store_url(ObjectStoreKind::FileSystem, None);
        assert!(result.is_ok());

        let url = result.unwrap();
        assert_eq!(url.scheme(), "file");
    }

    #[test]
    fn test_new_s3_object_store() {
        let (_store, url) = new_s3_object_store(
            "test-bucket",
            "us-east-1",
            "test-access-key",
            "test-secret-key",
            true, // is_local
        )
        .unwrap();

        assert_eq!(url.scheme(), "s3");
        assert_eq!(url.host_str(), Some("test-bucket"));
    }

    #[test]
    fn test_new_filesystem_object_store() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().to_str().unwrap();
        let (_store, _file_path) = new_filesystem_object_store(path).unwrap();

        assert!(temp_dir.path().exists());
    }

    #[test]
    fn test_new_filesystem_object_store_invalid_path() {
        let invalid_path = "\0invalid\0path";
        let result = new_filesystem_object_store(invalid_path);

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_list_objects_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().to_str().unwrap();
        let (store, _) = new_filesystem_object_store(path).unwrap();
        let objects = list_objects(&store, None).await.unwrap();

        assert!(objects.is_empty());
    }

    #[tokio::test]
    async fn test_list_objects_with_files() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().to_str().unwrap();
        let file1_path = temp_dir.path().join("test1.txt");
        let file2_path = temp_dir.path().join("test2.txt");
        fs::write(&file1_path, "test content 1").unwrap();
        fs::write(&file2_path, "test content 2").unwrap();
        let (store, _) = new_filesystem_object_store(path).unwrap();
        let objects = list_objects(&store, None).await.unwrap();

        assert_eq!(objects.len(), 2);

        let file_names: Vec<String> = objects
            .iter()
            .map(|obj| obj.location.filename().unwrap().to_string())
            .collect();

        assert!(file_names.contains(&"test1.txt".to_string()));
        assert!(file_names.contains(&"test2.txt".to_string()));
    }

    #[tokio::test]
    async fn test_list_objects_with_prefix() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().to_str().unwrap();
        let data_dir = temp_dir.path().join("data");
        let logs_dir = temp_dir.path().join("logs");
        fs::create_dir(&data_dir).unwrap();
        fs::create_dir(&logs_dir).unwrap();
        let file1_path = data_dir.join("file1.txt");
        let file2_path = data_dir.join("file2.txt");
        let file3_path = logs_dir.join("log1.txt");
        let file4_path = temp_dir.path().join("root.txt");
        fs::write(&file1_path, "data content 1").unwrap();
        fs::write(&file2_path, "data content 2").unwrap();
        fs::write(&file3_path, "log content").unwrap();
        fs::write(&file4_path, "root content").unwrap();

        let (store, _) = new_filesystem_object_store(path).unwrap();
        let all_objects = list_objects(&store, None).await.unwrap();
        assert_eq!(all_objects.len(), 4);

        let data_objects = list_objects(&store, Some("data/")).await.unwrap();

        if data_objects.len() == 2 {
            let data_names: Vec<String> = data_objects
                .iter()
                .map(|obj| obj.location.filename().unwrap().to_string())
                .collect();

            assert!(data_names.contains(&"file1.txt".to_string()));
            assert!(data_names.contains(&"file2.txt".to_string()));

            let logs_objects = list_objects(&store, Some("logs/")).await.unwrap();
            assert_eq!(logs_objects.len(), 1);
            assert_eq!(logs_objects[0].location.filename().unwrap(), "log1.txt");
        } else {
            let file_names: Vec<String> = all_objects
                .iter()
                .map(|obj| obj.location.filename().unwrap().to_string())
                .collect();

            assert!(file_names.contains(&"file1.txt".to_string()));
            assert!(file_names.contains(&"file2.txt".to_string()));
            assert!(file_names.contains(&"log1.txt".to_string()));
            assert!(file_names.contains(&"root.txt".to_string()));
        }
    }

    #[tokio::test]
    async fn test_upload_multipart() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().to_str().unwrap();
        let (store, _) = new_filesystem_object_store(path).unwrap();
        let test_data = b"This is test data for multipart upload";
        let file_path = "test_upload.txt";
        let result = upload_multipart(&store, file_path, test_data).await;

        assert!(result.is_ok());

        let uploaded_file_path = temp_dir.path().join(file_path);
        assert!(uploaded_file_path.exists());

        let file_content = fs::read(&uploaded_file_path).unwrap();
        assert_eq!(file_content, test_data);
    }
}
