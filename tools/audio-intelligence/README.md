# EpiNote Audio Intelligence

This is the first reusable checkpoint of EpiNote's server-side video
understanding workflow. It processes one YouTube URL as a batch job:

```text
YouTube URL -> audio-only download -> timestamped transcript
            -> grounded structured analysis -> validated job files
```

The module is intentionally a CLI. It proves the real ingestion and analysis
workflow without introducing a web UI, database schema, queue, or separate
service before those are needed.

## Requirements

- Node.js 24
- current `yt-dlp`
- FFmpeg
- `OPENROUTER_API_KEY`
- a Netscape-format YouTube cookie file with mode `0600`

The cookie should come from a dedicated test account. Never commit it, print it,
or leave it in `/tmp`. YouTube may expire the session and may restrict accounts
used by automated download tools.

## Run one job

```bash
export YOUTUBE_COOKIES_FILE=/home/epignos/.config/epinote-audio/youtube.cookies
export EPINOTE_AUDIO_JOB_ROOT=/home/epignos/.local/share/epinote-audio/jobs
npm run audio:process -- 'https://www.youtube.com/shorts/z9OicXWc20U'
```

For a detached server job:

```bash
screen -L -Logfile /home/epignos/.local/share/epinote-audio/runner.log \
  -dmS epinote-audio bash -lc '
    set -a
    . /home/epignos/.config/epinote/app.env
    set +a
    cd /opt/epinote/current
    export YOUTUBE_COOKIES_FILE=/home/epignos/.config/epinote-audio/youtube.cookies
    export EPINOTE_AUDIO_JOB_ROOT=/home/epignos/.local/share/epinote-audio/jobs
    export YT_DLP_BIN=/home/epignos/.local/bin/yt-dlp
    npm run audio:process -- "https://www.youtube.com/shorts/z9OicXWc20U"
  '
```

The command accepts exactly one supported HTTPS YouTube video URL. It
canonicalizes the URL and removes playlist or tracking parameters before
passing it to `yt-dlp`.

## Output contract

Each run creates a private job directory containing:

```text
manifest.json    current state, models, output files, exact cost, safe error
download.log     yt-dlp and FFmpeg diagnostics
audio.m4a        normalized audio, unless --remove-audio is used
transcript.json  text plus timestamped source segments and transcription usage
analysis.json    chapters, takeaways, concepts, claims, entities, limitations
usage.json       exact OpenRouter component and total cost
```

`analysis.json` is accepted only when all cited segment IDs exist and all
chapter timestamps fit inside the source duration. Speaker statements remain
attributed claims; they are not presented as independently verified facts.

The module processes audio only. It must state when information may depend on
unseen maps, slides, demonstrations, captions, or other visuals.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `YOUTUBE_COOKIES_FILE` | required | Protected Netscape cookie file |
| `EPINOTE_AUDIO_JOB_ROOT` | `tmp/audio-intelligence` | Private job directory root |
| `AUDIO_TRANSCRIPTION_MODEL` | `openai/whisper-large-v3` | OpenRouter transcription model |
| `AUDIO_INTELLIGENCE_MODEL` | `openai/gpt-5.6-luna` | Structured analysis model |
| `YT_DLP_BIN` | `yt-dlp` | yt-dlp executable or absolute path |
| `FFMPEG_BIN` | `ffmpeg` | FFmpeg executable or absolute path |

Audio larger than 25 MB is rejected before transcription. Chunking long audio
is intentionally deferred until a real input requires it.
