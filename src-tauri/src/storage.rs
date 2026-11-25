//! JSON files in the app's own folder. A save never leaves half a file.

use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Writes beside the file, then takes its place. The one before stays as `.bak`.
pub fn save(path: &Path, value: &Value) -> Result<(), String> {
    let say = |e: std::io::Error| format!("{}: {e}", path.display());
    if let Some(folder) = path.parent() {
        fs::create_dir_all(folder).map_err(say)?;
    }
    let fresh = path.with_extension("tmp");
    let mut file = fs::File::create(&fresh).map_err(say)?;
    file.write_all(value.to_string().as_bytes()).and_then(|()| file.sync_all()).map_err(say)?;
    drop(file);
    if path.exists() {
        let _ = fs::copy(path, path.with_extension("bak"));
    }
    fs::rename(&fresh, path).map_err(say)
}

/// The file, or its backup when the file is missing or damaged.
pub fn load(path: &Path) -> Option<Value> {
    let read = |p: &Path| serde_json::from_str(&fs::read_to_string(p).ok()?).ok();
    read(path).or_else(|| read(&path.with_extension("bak")))
}

/// Finished fights, one file each.
pub struct Fights(pub PathBuf);

impl Fights {
    fn file(&self, id: &str) -> Result<PathBuf, String> {
        // The id becomes a file name, so nothing in it may walk to another folder.
        let plain = |c: char| c.is_ascii_alphanumeric() || c == '_' || c == '-';
        if id.is_empty() || id.len() > 80 || !id.chars().all(plain) {
            return Err("not a fight".into());
        }
        Ok(self.0.join(format!("{id}.json")))
    }

    pub fn save(&self, fight: &Value) -> Result<(), String> {
        let path = self.file(fight["id"].as_str().unwrap_or_default())?;
        save(&path, fight)?;
        // A fight is written again as it grows, and the last is the whole of it.
        let _ = fs::remove_file(path.with_extension("bak"));
        Ok(())
    }

    pub fn load(&self, id: &str) -> Option<Value> {
        load(&self.file(id).ok()?)
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        fs::remove_file(self.file(id)?).map_err(|e| e.to_string())
    }

    /// Every fight without its skills and curve, newest first.
    pub fn list(&self) -> Vec<Value> {
        let files = fs::read_dir(&self.0).into_iter().flatten().flatten().map(|e| e.path());
        let json = files.filter(|p| p.extension().is_some_and(|e| e == "json"));
        let mut all: Vec<Value> = json.filter_map(|p| load(&p)).map(brief).collect();
        all.sort_by_key(|f| std::cmp::Reverse(f["start"].as_i64().unwrap_or(0)));
        all
    }
}

fn brief(mut fight: Value) -> Value {
    if let Some(f) = fight.as_object_mut() {
        f.remove("curve");
        if let Some(you) = f.get_mut("you").and_then(Value::as_object_mut) {
            you.remove("skills");
        }
    }
    fight
}

/// What may be written down of a fight. Other players become one sum: no names, classes or numbers of theirs.
pub fn only_yours(fight: &Value) -> Value {
    let rows = fight["rows"].as_array().map(Vec::as_slice).unwrap_or_default();
    let damage = |r: &&Value| r["damage"].as_i64().unwrap_or(0);
    let others: Vec<&Value> = rows.iter().filter(|r| r["you"] != true).collect();
    let mut kept = serde_json::Map::new();
    for key in ["id", "target", "code", "start", "ms", "total", "maxHp", "killed", "dummy", "dungeon", "curve"] {
        kept.insert(key.into(), fight[key].clone());
    }
    kept.insert("you".into(), rows.iter().find(|r| r["you"] == true).cloned().unwrap_or(Value::Null));
    kept.insert("others".into(), others.iter().map(damage).sum::<i64>().into());
    kept.insert("players".into(), rows.len().into());
    Value::Object(kept)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn folder(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("plume-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        path
    }

    #[test]
    fn a_damaged_file_gives_its_backup() {
        let path = folder("backup").join("settings.json");
        save(&path, &json!({ "a": 1 })).unwrap();
        save(&path, &json!({ "a": 2 })).unwrap();
        fs::write(&path, "{").unwrap();
        assert_eq!(load(&path), Some(json!({ "a": 1 })));
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn a_saved_fight_holds_nothing_of_other_players() {
        let fight = json!({
            "id": "auto_1_2", "target": "Boss", "start": 5, "ms": 9, "total": 30, "secret": 1,
            "rows": [
                { "id": 1, "name": "Stranger", "job": "cleric", "damage": 20, "you": false },
                { "id": 2, "name": "Me", "job": "ranger", "damage": 10, "you": true },
            ],
        });
        let kept = only_yours(&fight);
        assert_eq!((&kept["you"]["name"], &kept["others"], &kept["players"]), (&json!("Me"), &json!(20), &json!(2)));
        let text = kept.to_string();
        assert!(!text.contains("Stranger") && !text.contains("cleric") && !text.contains("rows") && !text.contains("secret"));
    }

    #[test]
    fn fights_are_listed_newest_first_and_an_id_cannot_leave_the_folder() {
        let fights = Fights(folder("fights"));
        for (id, start) in [("a", 1), ("b", 2)] {
            fights.save(&json!({ "id": id, "start": start, "curve": [1], "you": { "name": "Me", "skills": [1] } })).unwrap();
        }
        let list = fights.list();
        assert_eq!((list.len(), &list[0]["id"]), (2, &json!("b")));
        assert!(list[0].get("curve").is_none() && list[0]["you"].get("skills").is_none());
        assert_eq!(fights.load("a").unwrap()["curve"], json!([1]));
        for bad in ["", "..", "../a", "a/b", "C:\\x"] {
            assert!(fights.delete(bad).is_err(), "{bad}");
        }
        fights.delete("a").unwrap();
        assert!(fights.load("a").is_none());
        fs::remove_dir_all(&fights.0).unwrap();
    }
}
