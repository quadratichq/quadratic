//! AES CBC Encryption and Decryption
//!
//! Functions to encrypt and decrypt data using AES-256-CBC

use std::fmt::Debug;

use aes::{
    Aes256,
    cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit, block_padding::Pkcs7},
};
use bytes::Bytes;
use cbc::{Decryptor, Encryptor};

use crate::{SharedError, crypto::error::Crypto as CryptoError, error::Result};

type Aes256CbcEnc = Encryptor<Aes256>;
type Aes256CbcDec = Decryptor<Aes256>;

/// Encrypt data using AES-256-CBC.
pub fn encrypt(key: &[u8; 32], iv: &[u8; 16], data: &[u8]) -> Result<Bytes> {
    let encryptor = Aes256CbcEnc::new(key.into(), iv.into());
    let encrypted = encryptor.encrypt_padded_vec_mut::<Pkcs7>(data).to_owned();

    Ok(encrypted.into())
}

/// Convenience function to handle errors when decrypting data.
fn decrypt_error(e: impl Debug) -> SharedError {
    let error = CryptoError::AesCbcDecode(format!("Error decoding data: {e:?}"));
    SharedError::Crypto(error)
}

/// Decrypt data using AES-256-CBC.
pub fn decrypt(key: &[u8; 32], iv: &[u8; 16], data: &[u8]) -> Result<Bytes> {
    let decryptor = Aes256CbcDec::new(key.into(), iv.into());
    let decrypted = decryptor
        .decrypt_padded_vec_mut::<Pkcs7>(data)
        .map_err(decrypt_error)?
        .to_owned();

    Ok(decrypted.into())
}

/// Decrypt data from the Quadratic API, which prepends the IV to the data and is hex encoded.
pub fn decrypt_from_api(key: &str, data: &str) -> Result<String> {
    let key = hex::decode(key).map_err(decrypt_error)?;
    let key = key.try_into().map_err(decrypt_error)?;
    let parts = data.split(":").collect::<Vec<&str>>();
    let decoded_iv = hex::decode(parts[0]).map_err(decrypt_error)?;
    let iv = decoded_iv.as_slice().try_into().map_err(decrypt_error)?;
    let decoded_data = hex::decode(parts[1]).map_err(decrypt_error)?;
    let data = decoded_data.as_slice();
    let decrypted = decrypt(&key, iv, data)?;
    let decrypted_string = String::from_utf8(decrypted.to_vec()).map_err(decrypt_error)?;

    Ok(decrypted_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_and_decrypt_aes_cbc() {
        let key = [0x42; 32];
        let iv = [0x24; 16];
        let text = b"Hello, world!";

        let encrypted = encrypt(&key, &iv, text).unwrap();
        let decrypted = decrypt(&key, &iv, &encrypted).unwrap();

        assert_eq!(text, decrypted.as_ref());

        let api_data = format!("{}:{}", hex::encode(iv), hex::encode(encrypted));
        let decrypted = decrypt_from_api(&hex::encode(key), &api_data).unwrap();

        assert_eq!(text, decrypted.as_bytes());
    }
}
