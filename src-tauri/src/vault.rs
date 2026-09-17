use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::Value;
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};

pub struct Vault(pub Mutex<PathBuf>);
fn error(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 100
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
fn asset_path(root: &Path, id: &str) -> Result<PathBuf, String> {
    let (stem, ext) = id.rsplit_once('.').ok_or("Invalid image name")?;
    if !valid_id(stem) || !["png", "jpg", "webp", "gif"].contains(&ext) {
        return Err("Invalid image name".into());
    }
    Ok(root.join("assets").join(id))
}
fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let temp = path.with_extension("pending-write");
    let mut file = fs::File::create(&temp).map_err(error)?;
    file.write_all(content).map_err(error)?;
    file.sync_all().map_err(error)?;
    fs::rename(temp, path).map_err(error)
}
fn validate(workspace: &Value) -> Result<(), String> {
    if workspace["version"] != 1 {
        return Err("Unsupported notebook version".into());
    }
    let pages = workspace["pages"].as_array().ok_or("Missing pages")?;
    let mut ids = HashSet::new();
    for page in pages {
        let id = page["id"].as_str().ok_or("Missing page identifier")?;
        if !valid_id(id) || !ids.insert(id) || !page["body"].is_string() {
            return Err("Invalid or duplicate page".into());
        }
    }
    Ok(())
}
fn commit(root: &Path, workspace: &Value) -> Result<(), String> {
    validate(workspace)?;
    fs::create_dir_all(root.join("pages")).map_err(error)?;
    for page in workspace["pages"].as_array().unwrap() {
        atomic_write(
            &root
                .join("pages")
                .join(format!("{}.md", page["id"].as_str().unwrap())),
            page["body"].as_str().unwrap().as_bytes(),
        )?;
    }
    let mut metadata = workspace.clone();
    for page in metadata["pages"].as_array_mut().unwrap() {
        page.as_object_mut().unwrap().remove("body");
    }
    atomic_write(
        &root.join("notebook.json"),
        &serde_json::to_vec_pretty(&metadata).map_err(error)?,
    )
}
pub fn load(root: &Path) -> Result<Option<Value>, String> {
    let pending = root.join("transaction.json");
    if pending.exists() {
        let state: Value =
            serde_json::from_slice(&fs::read(&pending).map_err(error)?).map_err(error)?;
        commit(root, &state)?;
        fs::remove_file(&pending).map_err(error)?;
    }
    let path = root.join("notebook.json");
    if !path.exists() {
        return Ok(None);
    }
    let mut state: Value =
        serde_json::from_slice(&fs::read(path).map_err(error)?).map_err(error)?;
    for page in state["pages"].as_array_mut().ok_or("Missing pages")? {
        let id = page["id"].as_str().ok_or("Missing page identifier")?;
        if !valid_id(id) {
            return Err("Invalid page identifier".into());
        }
        page["body"] = Value::String(
            fs::read_to_string(root.join("pages").join(format!("{id}.md"))).map_err(error)?,
        );
    }
    validate(&state)?;
    Ok(Some(state))
}
pub fn save(root: &Path, workspace: &Value) -> Result<(), String> {
    validate(workspace)?;
    fs::create_dir_all(root).map_err(error)?;
    if let Some(old) = load(root)? {
        atomic_write(
            &root.join("previous-save.json"),
            &serde_json::to_vec_pretty(&old).map_err(error)?,
        )?;
    }
    // A journal rolls interrupted multi-file saves forward on next open.
    atomic_write(
        &root.join("transaction.json"),
        &serde_json::to_vec_pretty(workspace).map_err(error)?,
    )?;
    commit(root, workspace)?;
    fs::remove_file(root.join("transaction.json")).map_err(error)?;
    Ok(())
}
#[tauri::command]
pub fn load_workspace(vault: tauri::State<'_, Vault>) -> Result<Option<Value>, String> {
    load(&vault.0.lock().map_err(error)?)
}
#[tauri::command]
pub fn save_workspace(vault: tauri::State<'_, Vault>, workspace: Value) -> Result<(), String> {
    save(&vault.0.lock().map_err(error)?, &workspace)
}
#[tauri::command]
pub fn save_asset(
    vault: tauri::State<'_, Vault>,
    id: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    if bytes.len() > 12 * 1024 * 1024 {
        return Err("Image exceeds 12 MB".into());
    }
    let root = vault.0.lock().map_err(error)?;
    let path = asset_path(&root, &id)?;
    if path.exists() {
        return Err("Image already exists".into());
    }
    fs::create_dir_all(root.join("assets")).map_err(error)?;
    atomic_write(&path, &bytes)
}
#[tauri::command]
pub fn read_asset(vault: tauri::State<'_, Vault>, id: String) -> Result<String, String> {
    let root = vault.0.lock().map_err(error)?;
    let path = asset_path(&root, &id)?;
    let mime = if id.ends_with(".jpg") {
        "jpeg"
    } else {
        id.rsplit('.').next().unwrap()
    };
    let bytes = fs::read(path).map_err(error)?;
    if bytes.len() > 12 * 1024 * 1024 {
        return Err("Image exceeds 12 MB".into());
    }
    Ok(format!(
        "data:image/{mime};base64,{}",
        STANDARD.encode(bytes)
    ))
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn fixture() -> Value {
        json!({"version":1,"pages":[{"id":"page-one","body":"# Original\nHello"}],"runs":[]})
    }
    #[test]
    fn markdown_round_trip_and_journal_recovery() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("vault-test-{}", std::process::id()));
        let state = fixture();
        save(&root, &state).unwrap();
        assert_eq!(load(&root).unwrap(), Some(state.clone()));
        fs::write(root.join("pages/page-one.md"), "# External edit").unwrap();
        assert_eq!(
            load(&root).unwrap().unwrap()["pages"][0]["body"],
            "# External edit"
        );
        let mut changed = state;
        changed["pages"][0]["body"] = "# Recovered".into();
        fs::write(
            root.join("transaction.json"),
            serde_json::to_vec(&changed).unwrap(),
        )
        .unwrap();
        assert_eq!(load(&root).unwrap(), Some(changed));
        assert!(!root.join("transaction.json").exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rejects_path_traversal_and_duplicate_pages() {
        let mut bad = fixture();
        bad["pages"][0]["id"] = "../../escape".into();
        assert!(validate(&bad).is_err());
        let mut duplicate = fixture();
        let p = duplicate["pages"][0].clone();
        duplicate["pages"].as_array_mut().unwrap().push(p);
        assert!(validate(&duplicate).is_err());
        assert!(asset_path(Path::new("/vault"), "../evil.png").is_err());
        assert!(asset_path(Path::new("/vault"), "image.svg").is_err());
    }
}
