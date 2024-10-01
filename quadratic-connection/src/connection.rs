use quadratic_rust_shared::quadratic_api::{get_connection, Connection};
use serde::de::DeserializeOwned;
use uuid::Uuid;

use crate::{error::Result, state::State};

pub(crate) async fn get_api_connection<T: DeserializeOwned>(
    state: &State,
    jwt: &str,
    user_id: &str,
    connection_id: &Uuid,
) -> Result<Connection<T>> {
    let base_url = state.settings.quadratic_api_uri.to_owned();
    let connection = get_connection(&base_url, jwt, user_id, connection_id).await?;

    Ok(connection)
}
