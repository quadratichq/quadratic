use futures_util::TryStreamExt;
use object_store::local::LocalFileSystem;
pub use object_store::{ObjectMeta, ObjectStore, WriteMultipart, aws::AmazonS3Builder, path::Path};
use std::{path::PathBuf, sync::Arc};
pub use url::Url;

use crate::{SharedError, arrow::error::Arrow as ArrowError, error::Result};

pub fn object_store_error(e: impl ToString) -> SharedError {
    SharedError::Arrow(ArrowError::ObjectStore(e.to_string()))
}

pub enum ObjectStoreKind {
    S3,
    FileSystem,
}

pub fn object_store_url(kind: ObjectStoreKind, bucket_name: Option<&str>) -> Result<Url> {
    let url = match kind {
        ObjectStoreKind::S3 => format!(
            "s3://{}",
            bucket_name.ok_or_else(|| object_store_error("Bucket name is required"))?
        ),
        ObjectStoreKind::FileSystem => "file://".to_string(),
    };

    Ok(Url::parse(&url).map_err(object_store_error)?)
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
    let file_system = LocalFileSystem::new_with_prefix(path).map_err(object_store_error)?;
    let file_system_url = file_system
        .path_to_filesystem(&Path::from(path))
        .map_err(object_store_error)?;
    let arc_file_system = Arc::new(file_system);

    Ok((arc_file_system, file_system_url))
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
    let list_stream = object_store.list(prefix.map(|p| Path::from(p)).as_ref());
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
