use deno_core::{ModuleLoader, ModuleSource, ResolutionKind, url::Url};
use deno_error::JsErrorBox;

// Proper module loader implementation for ES imports
#[derive(Debug, Clone)]
pub(crate) struct QuadraticModuleLoader;

/// Hook up into the resolve function to handle ES imports.
impl ModuleLoader for QuadraticModuleLoader {
    #[allow(clippy::if_same_then_else)]
    fn resolve(
        &self,
        specifier: &str,
        referrer: &str,
        _kind: ResolutionKind,
    ) -> std::result::Result<Url, JsErrorBox> {
        // handle HTTP/HTTPS URLs directly
        if specifier.starts_with("http://") || specifier.starts_with("https://") {
            Url::parse(specifier).map_err(JsErrorBox::from_err)
        } else if specifier.starts_with("data:") {
            // handle data URLs directly
            Url::parse(specifier).map_err(JsErrorBox::from_err)
        } else if specifier.starts_with("file://") {
            // handle file URLs directly
            Url::parse(specifier).map_err(JsErrorBox::from_err)
        } else if specifier.starts_with("./") || specifier.starts_with("../") {
            // handle relative imports
            let referrer_url = Url::parse(referrer).map_err(JsErrorBox::from_err)?;
            referrer_url.join(specifier).map_err(JsErrorBox::from_err)
        } else if specifier.starts_with("/") {
            // handle absolute paths from CDNs (like /npm/d3-array@3.2.4/+esm from esm.run)
            if referrer.contains("esm.run") {
                // esm.run uses a special URL structure for npm packages
                if specifier.starts_with("/npm/")
                    && specifier.contains("@")
                    && specifier.ends_with("/+esm")
                {
                    // convert /npm/package@version/+esm to https://esm.run/package@version
                    let package_part = specifier
                        .strip_prefix("/npm/")
                        .ok_or_else(|| {
                            JsErrorBox::from_err(Box::new(std::io::Error::new(
                                std::io::ErrorKind::InvalidData,
                                "Invalid specifier",
                            )))
                        })
                        .and_then(|s| {
                            s.strip_suffix("/+esm").ok_or_else(|| {
                                JsErrorBox::from_err(Box::new(std::io::Error::new(
                                    std::io::ErrorKind::InvalidData,
                                    "Invalid specifier",
                                )))
                            })
                        })
                        .map_err(JsErrorBox::from_err)?;
                    Url::parse(&format!("https://esm.run/{}", package_part))
                        .map_err(JsErrorBox::from_err)
                } else {
                    // fallback to direct join
                    Url::parse(&format!("https://esm.run{}", specifier))
                        .map_err(JsErrorBox::from_err)
                }
            } else {
                // for other CDNs, use the referrer's origin
                let referrer_url = Url::parse(referrer).map_err(JsErrorBox::from_err)?;
                let base_url = format!(
                    "{}://{}",
                    referrer_url.scheme(),
                    referrer_url.host_str().unwrap_or("")
                );
                Url::parse(&format!("{}{}", base_url, specifier)).map_err(JsErrorBox::from_err)
            }
        } else if referrer.starts_with("file://") {
            Url::parse(&format!("https://esm.run/{}", specifier)).map_err(JsErrorBox::from_err)
        } else {
            Url::parse(&format!("https://esm.run/{}", specifier)).map_err(JsErrorBox::from_err)
        }
    }

    fn load(
        &self,
        module_specifier: &Url,
        _maybe_referrer: Option<&Url>,
        _is_dyn_import: bool,
        _requested_module_type: deno_core::RequestedModuleType,
    ) -> deno_core::ModuleLoadResponse {
        let module_specifier = module_specifier.clone();

        deno_core::ModuleLoadResponse::Async(Box::pin(async move {
            if module_specifier.scheme() == "https" || module_specifier.scheme() == "http" {
                // fetch from URL
                match reqwest::get(module_specifier.as_str()).await {
                    Ok(response) => match response.text().await {
                        Ok(code) => {
                            println!("✅ Fetched module from: {}", module_specifier.as_str());
                            println!("   Module code length: {} bytes", code.len());

                            // basic validation - check if it looks like JavaScript
                            if code.trim().is_empty() {
                                return Err(JsErrorBox::from_err(Box::new(std::io::Error::new(
                                    std::io::ErrorKind::InvalidData,
                                    "Empty module content",
                                ))));
                            }

                            // check if content looks like an error message
                            if code.trim().starts_with("<!DOCTYPE")
                                || code.trim().starts_with("<html")
                            {
                                return Err(JsErrorBox::from_err(Box::new(std::io::Error::new(
                                    std::io::ErrorKind::InvalidData,
                                    format!(
                                        "Received HTML instead of JavaScript: {}",
                                        &code.chars().take(100).collect::<String>()
                                    ),
                                ))));
                            }

                            // check for actual error responses (not just comments containing "error")
                            let trimmed = code.trim();
                            if trimmed == "Not found"
                                || trimmed == "Couldn't find the requested file."
                                || (trimmed.len() < 100
                                    && (trimmed.to_lowercase().contains("not found")
                                        || trimmed.to_lowercase().contains("404")))
                            {
                                return Err(JsErrorBox::from_err(Box::new(std::io::Error::new(
                                    std::io::ErrorKind::NotFound,
                                    format!("CDN returned error: {}", code.trim()),
                                ))));
                            }

                            Ok(ModuleSource::new(
                                deno_core::ModuleType::JavaScript,
                                deno_core::ModuleSourceCode::String(code.into()),
                                &module_specifier,
                                None,
                            ))
                        }
                        Err(e) => Err(JsErrorBox::from_err(Box::new(std::io::Error::other(
                            format!("Failed to read response: {}", e),
                        )))),
                    },
                    Err(e) => Err(JsErrorBox::from_err(Box::new(std::io::Error::other(
                        e.to_string(),
                    )))),
                }
            } else if module_specifier.scheme() == "file" {
                // handle file URLs (for local modules)
                match module_specifier.to_file_path() {
                    Ok(path) => match std::fs::read_to_string(&path) {
                        Ok(code) => Ok(ModuleSource::new(
                            deno_core::ModuleType::JavaScript,
                            deno_core::ModuleSourceCode::String(code.into()),
                            &module_specifier,
                            None,
                        )),
                        Err(e) => Err(JsErrorBox::from_err(Box::new(std::io::Error::other(
                            e.to_string(),
                        )))),
                    },
                    Err(_) => Err(JsErrorBox::from_err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        "Invalid file path",
                    )))),
                }
            } else if module_specifier.scheme() == "data" {
                // handle data URLs for in-memory modules
                // Format: data:text/javascript;charset=utf-8,<code>
                let data_url = module_specifier.as_str();

                if let Some(comma_pos) = data_url.find(',') {
                    let code = &data_url[comma_pos + 1..];
                    // url decode the content
                    match urlencoding::decode(code) {
                        Ok(decoded_code) => {
                            println!(
                                "✅ Loading in-memory module, code length: {} bytes",
                                decoded_code.len()
                            );
                            Ok(ModuleSource::new(
                                deno_core::ModuleType::JavaScript,
                                deno_core::ModuleSourceCode::String(
                                    decoded_code.into_owned().into(),
                                ),
                                &module_specifier,
                                None,
                            ))
                        }
                        Err(e) => Err(JsErrorBox::from_err(Box::new(std::io::Error::new(
                            std::io::ErrorKind::InvalidData,
                            format!("Failed to decode data URL: {}", e),
                        )))),
                    }
                } else {
                    Err(JsErrorBox::from_err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        "Invalid data URL format",
                    ))))
                }
            } else {
                Err(JsErrorBox::from_err(Box::new(std::io::Error::other(
                    format!("Unsupported module specifier: {}", module_specifier),
                ))))
            }
        }))
    }
}

// Execute code as an ES module using proper module loading
// Helper function to extract import statements from code
pub(crate) fn extract_imports(code: &str) -> (Vec<String>, String) {
    let lines: Vec<&str> = code.lines().collect();
    let mut imports = Vec::new();
    let mut non_import_lines = Vec::new();

    for line in lines {
        let trimmed = line.trim();
        if trimmed.starts_with("import ") || trimmed.starts_with("export ") {
            imports.push(line.to_string());
        } else {
            non_import_lines.push(line.to_string());
        }
    }

    (imports, non_import_lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use quadratic_core::controller::transaction_types::JsCellValueResult;

    use super::*;
    use crate::javascript::execute::tests::test_execute;

    #[tokio::test(flavor = "current_thread")]
    async fn test_d3_import() {
        let code = r#"
import * as d3 from 'https://esm.run/d3';
let oneDArray = [1, 2, 3, 4, 5];
let max_number = d3.max(oneDArray);
return 'Max number is: ' + max_number;
"#;
        let result = test_execute(code).await;

        assert!(result.success);
        assert_eq!(
            result.output_value,
            Some(JsCellValueResult("Max number is: 5".into(), 1))
        );
    }

    #[test]
    fn test_extract_imports() {
        let code = r#"import * as d3 from 'https://esm.run/d3';
let oneDArray = [1, 2, 3, 4, 5];
let max_number = d3.max(oneDArray);
return 'Max number is: ' + max_number;"#;

        let (imports, non_import_code) = extract_imports(code);

        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0], "import * as d3 from 'https://esm.run/d3';");

        let expected_non_import = r#"let oneDArray = [1, 2, 3, 4, 5];
let max_number = d3.max(oneDArray);
return 'Max number is: ' + max_number;"#;
        assert_eq!(non_import_code, expected_non_import);
    }

    #[test]
    fn test_extract_imports_multiple() {
        let code = r#"import React from 'react';
import { useState } from 'react';
export const MyComponent = () => {};

const x = 42;
console.log(x);"#;

        let (imports, non_import_code) = extract_imports(code);

        assert_eq!(imports.len(), 3);
        assert_eq!(imports[0], "import React from 'react';");
        assert_eq!(imports[1], "import { useState } from 'react';");
        assert_eq!(imports[2], "export const MyComponent = () => {};");

        let expected_non_import = r#"
const x = 42;
console.log(x);"#;
        assert_eq!(non_import_code, expected_non_import);
    }

    #[test]
    fn test_extract_imports_none() {
        let code = r#"const x = 42;
console.log('hello world');
return x + 1;"#;

        let (imports, non_import_code) = extract_imports(code);

        assert_eq!(imports.len(), 0);
        assert_eq!(non_import_code, code);
    }
}
