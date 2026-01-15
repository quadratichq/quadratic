use sqlx::{PgPool, query_scalar};
use uuid::Uuid;

use crate::error::Result;
use crate::quadratic_database::error::QuadraticDatabase;

/*
-- Table Definition
CREATE TABLE "public"."FileCheckpoint" (
    "id" int4 NOT NULL DEFAULT nextval('"FileCheckpoint_id_seq"'::regclass),
    "file_id" int4 NOT NULL,
    "sequence_number" int4 NOT NULL,
    "s3_bucket" text NOT NULL,
    "s3_key" text NOT NULL,
    "version" text NOT NULL,
    "timestamp" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactions_hash" text,
    CONSTRAINT "FileCheckpoint_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."File"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    PRIMARY KEY ("id")
);
*/

/// Get the maximum sequence number for a file
///
/// # Arguments
///
/// * `pool` - The PostgreSQL pool
/// * `file_id` - The UUID of the file
///
/// # Returns
///
pub async fn get_max_sequence_number(pool: &PgPool, file_id: &Uuid) -> Result<i32> {
    let query = "
        SELECT MAX(\"sequence_number\")
        FROM \"FileCheckpoint\" fc
        INNER JOIN \"File\" f ON fc.\"file_id\" = f.\"id\"
        WHERE f.\"uuid\" = $1::text";

    let result: Option<i32> = query_scalar(query)
        .bind(file_id)
        .fetch_one(pool)
        .await
        .map_err(QuadraticDatabase::from)?;

    result.ok_or_else(|| {
        QuadraticDatabase::NotFound(format!("No checkpoint found for file {}", file_id)).into()
    })
}

/// Set the file's checkpoint with the quadratic database
///
/// # Arguments
///
/// * `pool` - The PostgreSQL pool
/// * `file_id` - The UUID of the file
/// * `sequence_number` - The sequence number of the checkpoint
/// * `s3_bucket` - The S3 bucket name
/// * `version` - The version string
/// * `transactions_hash` - Optional hash of the transactions
///
/// # Returns
pub async fn set_file_checkpoint(
    pool: &PgPool,
    file_id: &Uuid,
    sequence_number: i32,
    s3_bucket: &str,
    version: &str,
    transactions_hash: &str,
) -> Result<()> {
    let s3_key = format!("{file_id}-{sequence_number}.grid");
    let query = "
        INSERT INTO \"FileCheckpoint\" (file_id, sequence_number, s3_bucket, s3_key, version, transactions_hash)
        SELECT f.\"id\", $2, $3, $4, $5, $6
        FROM \"File\" f
        WHERE f.\"uuid\" = $1::text
        ON CONFLICT (file_id, sequence_number) DO NOTHING";

    sqlx::query(query)
        .bind(file_id)
        .bind(sequence_number)
        .bind(s3_bucket)
        .bind(s3_key)
        .bind(version)
        .bind(transactions_hash)
        .execute(pool)
        .await
        .map_err(QuadraticDatabase::from)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::{SharedError, quadratic_database::connect_test};

    use super::*;

    async fn test_setup() -> (PgPool, Uuid, i32, i32, i32) {
        let file_uuid = Uuid::new_v4();
        let team_uuid = Uuid::new_v4();
        let user_auth0_id = format!("test-auth0-{}", Uuid::new_v4());
        let pool = connect_test().await.unwrap();

        // Create a test User (required FK for File.creator_user_id)
        let user_id: i32 = sqlx::query_scalar(
            "INSERT INTO \"User\" (auth0_id, email) 
             VALUES ($1, $2) 
             RETURNING id",
        )
        .bind(&user_auth0_id)
        .bind(format!("test-{}@example.com", Uuid::new_v4()))
        .fetch_one(&pool)
        .await
        .unwrap();

        // Create a test Team (required FK for File.owner_team_id)
        let team_id: i32 = sqlx::query_scalar(
            "INSERT INTO \"Team\" (uuid, name) 
             VALUES ($1::text, 'test-team') 
             RETURNING id",
        )
        .bind(team_uuid)
        .fetch_one(&pool)
        .await
        .unwrap();

        let file_id: i32 = sqlx::query_scalar(
            "INSERT INTO \"File\" (uuid, name, created_date, updated_date, owner_team_id, creator_user_id) 
             VALUES ($1::text, 'test-file', NOW(), NOW(), $2, $3) 
             RETURNING id",
        )
        .bind(file_uuid)
        .bind(team_id)
        .bind(user_id)
        .fetch_one(&pool)
        .await
        .unwrap();

        (pool, file_uuid, file_id, team_id, user_id)
    }

    async fn test_teardown(pool: &PgPool, file_id: i32, team_id: i32, user_id: i32) {
        sqlx::query("DELETE FROM \"FileCheckpoint\" WHERE file_id = $1")
            .bind(file_id)
            .execute(pool)
            .await
            .unwrap();
        sqlx::query("DELETE FROM \"File\" WHERE id = $1")
            .bind(file_id)
            .execute(pool)
            .await
            .unwrap();
        sqlx::query("DELETE FROM \"Team\" WHERE id = $1")
            .bind(team_id)
            .execute(pool)
            .await
            .unwrap();
        sqlx::query("DELETE FROM \"User\" WHERE id = $1")
            .bind(user_id)
            .execute(pool)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_file_checkpoint() {
        let (pool, file_uuid, file_id, team_id, user_id) = test_setup().await;

        // Get current max sequence number (should be None for new file)
        let not_found = get_max_sequence_number(&pool, &file_uuid)
            .await
            .unwrap_err();
        assert!(matches!(
            not_found,
            SharedError::QuadraticDatabase(QuadraticDatabase::NotFound(_))
        ));

        let seq_num = 100;

        // Insert a new checkpoint
        set_file_checkpoint(
            &pool,
            &file_uuid,
            seq_num,
            "test-bucket",
            "1.0.0",
            "test-hash",
        )
        .await
        .unwrap();

        // Verify the max sequence number is set
        let max_sequence_num = get_max_sequence_number(&pool, &file_uuid).await.unwrap();
        assert_eq!(max_sequence_num, seq_num);

        test_teardown(&pool, file_id, team_id, user_id).await;
    }
}
