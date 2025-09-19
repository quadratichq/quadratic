use serde::Deserialize;

pub mod mixpanel;

fn deserialize_int_to_bool<'de, D>(deserializer: D) -> Result<Option<bool>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    match Option::<u32>::deserialize(deserializer)? {
        Some(0) => Ok(Some(false)),
        Some(_) => Ok(Some(true)),
        None => Ok(None),
    }
}
