# API Data Contract

## Overview

All data flowing through the application follows a strict casing convention:

| Layer | Convention | Example |
|---|---|---|
| Cloudflare D1 / SQL | `snake_case` | `first_name`, `session_date` |
| Worker API responses | `camelCase` | `firstName`, `sessionDate` |
| Frontend (React) | `camelCase` | `player.firstName` |

## Serialization

All Worker route handlers use shared utilities from `worker/src/lib/serializers.js`:

```js
import { toCamel, toCamelArray } from '../../lib/serializers.js';

// Single object
return Response.json({ player: toCamel(row) });

// Array
return Response.json({ players: toCamelArray(rows) });
```

`toCamel` recursively converts all `snake_case` keys to `camelCase`, including nested objects and arrays.

## Response Shape

All list endpoints return a named key (never a raw array):

```json
{ "players": [...], "total": 42 }
{ "sessions": [...], "total": 10 }
{ "bookings": [...], "total": 5 }
```

Single-record endpoints return the object directly or under a named key:

```json
{ "id": "...", "firstName": "...", ... }
```

## Frontend Usage

The frontend `apiClient` (`src/services/apiClient.js`) does **not** apply any casing transforms — it relies on the Worker to send camelCase. Use `unwrap(data, 'players')` to safely extract the array from list responses.

```js
import { apiClient, unwrap } from '@/services/apiClient';

const data = await apiClient.get('/players');
const players = unwrap(data, 'players'); // data.players || []
```

## Rules

1. **Never** access `snake_case` properties on the frontend (e.g. `p.first_name`) — always use the camelCase form (`p.firstName`).
2. **Never** return raw arrays from Worker list routes — always use a named key.
3. **Never** manually map fields in Worker routes — use `toCamel` / `toCamelArray`.
4. Worker routes that accept `POST`/`PUT`/`PATCH` bodies receive camelCase from the frontend and must map to `snake_case` before DB writes.