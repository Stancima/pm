# Scripts

Run from anywhere; each script changes to the project root first.

- `start.sh` (Mac/Linux), `start.ps1` (Windows) - build the `pm` image, replace any existing `pm` container, and run it detached on port 8000 with `--env-file .env` and the `pm-data` volume mounted at `/data`
- `stop.sh`, `stop.ps1` - remove the `pm` container (the `pm-data` volume is kept)
