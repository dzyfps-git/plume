//! Your pets, as the game says them. Plume keeps them itself, so none is missed while the overlays are off,
//! and only the pets are written: what a page changed in the meantime stays.

use serde_json::{Map, Value};

/// Souls from one level to the next. The same as `NEEDED` in `src/features/pets/logic.ts`.
const NEEDED: [i64; 3] = [5, 25, 75];

fn pairs(said: &Value, key: &str) -> Vec<(String, i64)> {
    let all = said[key].as_array().into_iter().flatten();
    all.filter_map(|p| Some((p[0].as_i64()?.to_string(), p[1].as_i64()?))).collect()
}

fn clean(all: Map<String, Value>) -> Value {
    Value::Object(all.into_iter().filter(|(_, n)| n.as_i64().unwrap_or(0) > 0).collect())
}

/// What the game said, put into what is kept: `levels` and `souls`, by pet.
pub fn hear(kept: &Value, said: &Value) -> (Value, Value) {
    if said["what"] == "all" {
        let by = |key: &str, most: i64| clean(pairs(said, key).into_iter().map(|(id, n)| (id, n.min(most).into())).collect());
        return (by("levels", 3), by("souls", 100_000));
    }
    let mut levels = kept["levels"].as_object().cloned().unwrap_or_default();
    let mut souls = kept["souls"].as_object().cloned().unwrap_or_default();
    let of = |all: &Map<String, Value>, id: &str| all.get(id).and_then(Value::as_i64).unwrap_or(0);
    let souls_said = said["what"] == "souls";
    for (id, n) in pairs(said, if souls_said { "souls" } else { "levels" }) {
        let (mut level, mut have) = (of(&levels, &id).clamp(0, 3), of(&souls, &id));
        if souls_said {
            have += n;
            // A level comes by itself once there are souls enough. Those past it stay.
            while level < 3 && have >= NEEDED[level as usize] {
                have -= NEEDED[level as usize];
                level += 1;
            }
        } else {
            while level < n.min(3) {
                have = (have - NEEDED[level as usize]).max(0);
                level += 1;
            }
        }
        levels.insert(id.clone(), level.into());
        souls.insert(id, have.into());
    }
    (clean(levels), clean(souls))
}

#[cfg(test)]
mod tests {
    use super::hear;
    use serde_json::{Value, json};

    fn kept(levels: Value, souls: Value) -> Value {
        json!({ "levels": levels, "souls": souls })
    }

    #[test]
    fn all_replaces_souls_add_and_level_by_themselves_a_level_takes_its_cost_once() {
        let (levels, souls) = hear(&kept(json!({ "9": 2 }), json!({ "9": 4 })), &json!({ "what": "all", "levels": [[1066, 1], [1004, 0]], "souls": [[1066, 24], [1004, 3]] }));
        assert_eq!((&levels, &souls), (&json!({ "1066": 1 }), &json!({ "1066": 24, "1004": 3 })));
        let all = kept(levels, souls);
        let (levels, souls) = hear(&all, &json!({ "what": "souls", "levels": [], "souls": [[1066, 3], [1004, 2]] }));
        assert_eq!((&levels, &souls), (&json!({ "1066": 2, "1004": 1 }), &json!({ "1066": 2 })));
        // Said again after the souls did it: nothing more is taken.
        let up = kept(levels, souls);
        let (levels, souls) = hear(&up, &json!({ "what": "level", "levels": [[1066, 2]], "souls": [] }));
        assert_eq!(kept(levels, souls), up);
        let by = hear(&kept(json!({}), json!({ "7": 30 })), &json!({ "what": "level", "levels": [[7, 2]], "souls": [] }));
        assert_eq!(by, (json!({ "7": 2 }), json!({})));
        let top = hear(&kept(json!({ "7": 3 }), json!({})), &json!({ "what": "souls", "levels": [], "souls": [[7, 9]] }));
        assert_eq!(top, (json!({ "7": 3 }), json!({ "7": 9 })), "souls past the last level stay");
    }
}
