# BANK! PWA

Installable, offline-capable scorekeeper for the BANK dice game.

## Run locally

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Phone on same network

1. Find your computer LAN IP using `ipconfig`.
2. Open `http://YOUR_IP:8080` from your phone.

## iPhone install

Use Safari -> Share -> Add to Home Screen.

## Rules implemented

- 10/15/20 round game
- Sequential turns
- First 3 rolls in a round:
  - Rolling 7 adds 70
  - Doubles add face value only
- From roll 4 onward:
  - Rolling 7 ends the round
  - Doubles double the current BANK total
- Any active player can BANK current total once per round
- Players who BANK sit out until next round
- Round ends on 7 (after first 3 rolls) or when everyone has BANKED
- Roll entry via one-tap buttons (2-12) plus a DOUBLES! action button
- DOUBLES! is disabled during the first 3 rolls of each round
- Undo button for correcting accidental taps
