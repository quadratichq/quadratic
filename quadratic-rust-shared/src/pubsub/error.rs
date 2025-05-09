use crate::SharedError;

impl From<redis::RedisError> for SharedError {
    fn from(error: redis::RedisError) -> Self {
        SharedError::PubSub(error.to_string())
    }
}
