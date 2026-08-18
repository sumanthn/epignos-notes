# Audio Intelligence server POC

Status: one-video vertical slice verified on 2026-08-17

The first EpiNote Audio Intelligence spike ran entirely on the dev-test server.
No media or transcript processing ran on the local Mac.

## Verified input

```text
https://www.youtube.com/shorts/z9OicXWc20U
```

The source was a 70-second public Business Insider Short. The server's public IP
was challenged by YouTube, so the test used a dedicated authenticated cookie
export stored at:

```text
/home/epignos/.config/epinote-audio/youtube.cookies  mode 0600
```

Both manually uploaded `/tmp` copies were removed after the protected copy was
validated. Cookie values, the OpenRouter key, and account credentials were not
printed or committed.

## Verified result

- audio-only extraction: 2,468,867-byte M4A
- timestamped transcription: 70.364 seconds, 19 segments
- analysis: 4 chapters, 5 takeaways, 4 concepts, 7 attributed claims,
  3 entities, and 3 audio-only limitations
- every evidence segment ID and chapter time range passed deterministic
  validation
- transcription cost: USD 0.00216956614656
- structured analysis cost: USD 0.001054025
- total OpenRouter cost: USD 0.00322359114656

The generated title was `The Impact of AI Data Center Expansion`. The result
summarized the publisher's data-center map and its reported electricity, water,
community, and household-cost impacts. Resource-use and community-impact
statements remained attributed claims rather than verified facts. The result
also stated that the map itself could not be assessed from audio alone.

## Operational findings

1. Use one detached `screen` job per submitted video.
2. Use the actual Node executable path when enabling yt-dlp's JavaScript runtime.
   On dev-test this is `/usr/local/bin/node`, not `/usr/bin/node`.
3. Enable yt-dlp's official EJS solver components for current YouTube JavaScript
   challenges.
4. Use cookies only when necessary, keep request rates low, and expect sessions
   to expire.
5. Preserve the timestamped transcript as evidence and reject model citations
   that do not exist.
6. Record provider-reported cost per job instead of relying on estimates.

The checked-in CLI at `tools/audio-intelligence/` implements this proven flow.
