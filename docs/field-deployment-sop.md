# Arc N Code Business Suite — Field Deployment SOP

**Document version:** 1.0  
**Audience:** Field technicians with general IT competency (not deep networking expertise)  
**Applies to:** On-site physical installs of the Arc N Code local stack (Phase 0 foundation)

---

## 1. Purpose and scope

### 1.1 What this document is for

This Standard Operating Procedure (SOP) walks you through installing Arc N Code at a customer site: network setup, server wiring, initial provisioning, and verification before you leave.

### 1.2 Who runs this SOP

- Arc N Code field technicians
- Partner installers working under Arc N Code direction

### 1.3 What “done” looks like

You may leave site when **all** of the following are true:

- Office, Shop-Floor IoT, and Guest networks are isolated (VLAN + SSID)
- Server is physically installed, labeled, and on redundant power (UPS) where required
- Docker stack boots cleanly (`postgres`, `redis`, `minio`, `api`)
- `/api/health` reports **postgres**, **redis**, and **minio** as connected
- Admin login works and credentials are handed off securely
- Pre-flight checklist (Section 5) is fully checked off and signed

### 1.4 Prerequisites — bring to site

- [ ] Site hardware manifest (router, switch, APs, server, UPS, cables)
- [ ] Laptop with Ethernet adapter and site Wi‑Fi credentials (temporary)
- [ ] Printed copies of Section 5 (Pre-flight) and Section 6 (Server readiness)
- [ ] USB drive or secure note with production `.env` values (never email secrets)
- [ ] Site-specific provisioning token (when automated flow is available — see Section 4)
- [ ] Customer contact name and escalation phone number

---

## 2. Network hardware setup

Goal: three isolated networks so office staff, shop-floor devices, and guests cannot reach each other or the server management plane without explicit rules.

### 2.1 Recommended VLAN and subnet plan

Use these defaults unless Arc N Code operations provides a site-specific plan:

| Network | VLAN ID | Subnet | SSID name (example) | Purpose |
|---------|---------|--------|---------------------|---------|
| Office | 10 | 192.168.10.0/24 | `ANC-Office` | PCs, printers, ERP browsers |
| Shop-Floor IoT | 20 | 192.168.20.0/24 | `ANC-Shop` | Tablets, scanners, MES terminals |
| Guest | 30 | 192.168.30.0/24 | `ANC-Guest` | Visitor Wi‑Fi only |
| Server / Management | 99 | 192.168.99.0/24 | *(wired only)* | Arc N Code server, switch management |

- Gateway for each VLAN: `.1` on that subnet (e.g. Office gateway = `192.168.10.1`)
- Server static IP (example): `192.168.99.10/24`, gateway `192.168.99.1`
- DNS: customer-provided or `192.168.10.1` (router)

### 2.2 Isolation rules (both platforms)

Apply these firewall / ACL rules on the router or gateway:

1. **Guest (VLAN 30)** → Internet only. Block all access to VLAN 10, 20, and 99.
2. **Shop-Floor IoT (VLAN 20)** → May reach server API port **3000** on VLAN 99 only. Block access to Office VLAN 10 and guest VLAN 30.
3. **Office (VLAN 10)** → May reach server API port **3000** and MinIO console **9001** on VLAN 99. Block guest VLAN 30.
4. **Server / Management (VLAN 99)** → No inbound from Guest. Allow SSH (22) and HTTPS management only from Office VLAN if remote admin is required.

Document the final IP of the server on the cable label (Section 3).

---

### 2.3 Ubiquiti UniFi setup

**Console:** UniFi Network application (cloud or local controller)

#### Step 1 — Create networks (Settings → Networks → Create New)

For each row in the table above, create a **Virtual Network**:

1. **Office** — VLAN ID `10`, subnet `192.168.10.1/24`, DHCP enabled
2. **Shop-Floor IoT** — VLAN ID `20`, subnet `192.168.20.1/24`, DHCP enabled
3. **Guest** — VLAN ID `30`, subnet `192.168.30.1/24`, enable **Guest Network** (client isolation)
4. **Server / Management** — VLAN ID `99`, subnet `192.168.99.1/24`, DHCP optional (server uses static IP)

#### Step 2 — Create Wi‑Fi networks (Settings → WiFi → Create New)

| SSID | Network | Security | Notes |
|------|---------|----------|-------|
| `ANC-Office` | Office (VLAN 10) | WPA2/WPA3 | Strong passphrase; share with office staff only |
| `ANC-Shop` | Shop-Floor IoT (VLAN 20) | WPA2/WPA3 | Used by tablets/scanners |
| `ANC-Guest` | Guest (VLAN 30) | WPA2 + portal optional | Enable guest policies / isolation |

#### Step 3 — Switch port for server (Devices → Switch → Ports)

1. Select the switch port connected to the Arc N Code server.
2. Set **Native VLAN / Network** to **Server / Management (VLAN 99)**.
3. Disable other VLANs on that port (access port, not trunk).
4. Label the physical port on the switch: `SRV-ANC-01`.

#### Step 4 — Firewall rules (Settings → Firewall & Security → Create Rule)

Create LAN IN rules matching Section 2.2. Example for UniFi:

- **Block Guest to RFC1918** — Source: Guest network → Destination: RFC1918 → Action: Drop
- **Allow Shop to Server API** — Source: Shop-Floor IoT → Destination: `192.168.99.10`, port `3000` → Accept
- **Allow Office to Server API** — Source: Office → Destination: `192.168.99.10`, ports `3000`, `9001` → Accept

Apply changes and verify Wi‑Fi clients receive IPs on the correct subnets.

---

### 2.4 TP-Link Omada setup

**Console:** Omada Controller (hardware controller, OC200/OC300, or software)

#### Step 1 — Create VLAN interfaces (Settings → Wired Networks → LAN → Create New LAN)

For each network:

1. **Office** — VLAN `10`, gateway `192.168.10.1/24`, enable DHCP
2. **Shop-Floor IoT** — VLAN `20`, gateway `192.168.20.1/24`, enable DHCP
3. **Guest** — VLAN `30`, gateway `192.168.30.1/24`, enable DHCP, enable **Guest Network**
4. **Server / Management** — VLAN `99`, gateway `192.168.99.1/24`, static assignment for server

#### Step 2 — Create SSIDs (Settings → Wireless Networks → Create)

| SSID | VLAN | Security |
|------|------|----------|
| `ANC-Office` | 10 | WPA2-PSK or WPA3 |
| `ANC-Shop` | 20 | WPA2-PSK or WPA3 |
| `ANC-Guest` | 30 | WPA2-PSK + guest isolation |

Assign SSIDs to all site access points.

#### Step 3 — Switch port profile (Settings → Wired Networks → Profiles)

1. Create profile **Server-Mgmt** — Untagged VLAN `99`, no other VLANs.
2. Apply profile to the port connected to the Arc N Code server.
3. Label port: `SRV-ANC-01`.

#### Step 4 — ACL / Gateway firewall (Settings → Transmission → Firewall → ACL)

Add rules equivalent to Section 2.2:

- Deny Guest → private subnets
- Permit Shop-Floor → `192.168.99.10:3000`
- Permit Office → `192.168.99.10:3000,9001`

Save and provision all Omada devices.

---

### 2.5 Network verification (both platforms)

- [ ] Office laptop on `ANC-Office` receives `192.168.10.x` address
- [ ] Shop tablet on `ANC-Shop` receives `192.168.20.x` address
- [ ] Guest phone on `ANC-Guest` receives `192.168.30.x` and **cannot** ping `192.168.99.10`
- [ ] Office laptop **can** reach `http://192.168.99.10:3000/api` (after server is up)

---

## 3. Server hardwiring standards

### 3.1 Physical placement

1. Install the server in a **locked network cabinet or dedicated rack** in a climate-controlled area (not directly on the shop floor unless rated for that environment).
2. Minimum clearance: 10 cm (4 in) rear and sides for airflow.
3. Keep the server on the **Server / Management VLAN (99)** — never on Guest or IoT Wi‑Fi.

### 3.2 Cabling

1. Use **Cat6** (or better) for all permanent runs.
2. Terminate to patch panel and label both ends.
3. **Cable labeling convention:**

   ```
   <SITE>-<FROM>-<TO>-<VLAN>
   Example: ACME-RACK1-SW-P12-SRV-ANC-99
   ```

4. Server primary NIC → switch port labeled `SRV-ANC-01` (VLAN 99 access port).
5. Document server MAC address and static IP on the install worksheet.

### 3.3 Power

1. Connect server to a **UPS** sized for at least 15 minutes runtime at server load.
2. Label UPS outlet: `SRV-ANC-01-UPS`.
3. Where a second PSU exists, connect to a **separate circuit** or PDU branch when possible.
4. Verify clean shutdown procedure is documented for customer (graceful `docker compose down` before extended power work).

### 3.4 Physical security checklist

- [ ] Server rack/cabinet locked; keys handed to customer IT contact
- [ ] All cables labeled per convention above
- [ ] UPS installed and passing self-test
- [ ] Static IP configured and recorded: `_________________________`

---

## 4. Site provisioning and registry token

### 4.1 Intended flow (target architecture)

Each site receives a unique **provisioning token** before shipment. On first boot:

1. Token is embedded in server config (environment file or sealed config volume).
2. Server calls the central Arc N Code registration service with the token.
3. Central system associates the hardware with the customer site record.
4. Server receives site-specific settings and completes automated setup.

This enables inventory tracking, remote support, and license enforcement without manual re-entry at every site.

### 4.2 Current state — manual interim process (Phase 0)

> **TODO (Phase 1+):** Automated site registration and provisioning-token endpoint are **not built yet**. Phase 0 provides JWT auth (Admin/Manager roles) only — no `/api/provision` or registry API exists.

Until the automated endpoint ships, use this **manual interim process**:

1. **Before site visit:** Operations creates a site record in the internal tracker (site name, customer ID, planned static IP).
2. **On server:** Copy `.env.example` to `.env` and set production values:
   - Strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (never use dev defaults in production)
   - `DATABASE_URL`, `REDIS_URL`, MinIO credentials per site
   - Record site name and customer ID in your install worksheet (not yet stored in app DB until Phase 1+)
3. **First boot:** Run migrations and seed (or site-specific admin credentials provided by operations):

   ```bash
   docker compose up -d
   npm run prisma:migrate:deploy
   npm run prisma:seed
   ```

4. **Change default passwords immediately** after seed — the seed script creates `admin@arcncode.local` / `Admin123!` for development only. Replace with customer-specific credentials before handoff.
5. **Store the provisioning token** (when issued) in a sealed envelope on the server chassis or in the site binder — it will be consumed automatically once Phase 1+ registration is live.

### 4.3 Where the automated flow will plug in (Phase 1+)

| Component | Future location |
|-----------|-----------------|
| Provisioning token env var | `SITE_PROVISIONING_TOKEN` in `.env` |
| Registration API | `POST /api/provision/register` (planned) |
| Health check after register | `/api/health` + registration status field |

Field techs should not build or guess these endpoints — follow updated SOP revision when Phase 1+ ships.

---

## 5. Pre-flight checklist (before leaving site)

**Site name:** _________________________  
**Technician:** _________________________  
**Date:** _________________________  
**Customer IT contact:** _________________________

Print this section and check each box physically before departure.

### Network

- [ ] All three SSIDs broadcast and assign correct VLAN subnets
- [ ] Guest network cannot reach server or office subnets (ping test failed as expected)
- [ ] Shop-Floor devices can reach server API port 3000
- [ ] Firewall rules documented in site binder or controller export saved

### Server physical

- [ ] Server mounted, cabled, and labeled per Section 3
- [ ] UPS installed and tested
- [ ] Static IP confirmed: _________________________

### Software stack

- [ ] `.env` configured with production secrets (not dev defaults)
- [ ] `docker compose up -d` completes without errors
- [ ] All four containers running: `anc-postgres`, `anc-redis`, `anc-minio`, `anc-api`
- [ ] Section 6 server readiness checks all passed

### Security and handoff

- [ ] Default seed passwords changed (if seed was used)
- [ ] Admin credentials provided to customer IT via secure channel
- [ ] Rack/cabinet keys handed off
- [ ] Install photos taken (rack, labels, network map) and uploaded to operations

### Sign-off

- [ ] Customer IT representative informed that stack is live
- [ ] Escalation contact confirmed: _________________________

**Technician signature:** _________________________  
**Customer signature (optional):** _________________________

---

## 6. Server readiness verification

Run these steps **on the server** (SSH or local console) after `docker compose up -d`. Replace `192.168.99.10` with the site server IP.

### 6.1 Start the stack

From the application directory (contains `docker-compose.yml`):

```bash
docker compose up -d
```

Expected containers (from `docker-compose.yml`):

- `anc-postgres` — PostgreSQL database
- `anc-redis` — Redis (cache and event bus)
- `anc-minio` — Object storage
- `anc-api` — NestJS API on port **3000**

Verify all containers are running:

```bash
docker compose ps
```

- [ ] All four services show **running** (healthy after warm-up)

### 6.2 Health endpoint — `/api/health`

The Phase 0 health watchdog checks PostgreSQL, Redis, and MinIO connectivity.

```bash
curl -s http://localhost:3000/api/health
```

Or from an Office VLAN workstation:

```bash
curl -s http://192.168.99.10:3000/api/health
```

**Pass criteria:**

- HTTP status **200**
- JSON body includes `"status": "ok"` (or equivalent Terminus healthy response)
- `info` section shows **postgres**, **redis**, and **minio** as up/connected

Example of a healthy response shape:

```json
{
  "status": "ok",
  "info": {
    "postgres": { "status": "up" },
    "redis": { "status": "up" },
    "minio": { "status": "up" }
  }
}
```

- [ ] `/api/health` returns HTTP 200
- [ ] postgres — up
- [ ] redis — up
- [ ] minio — up

If status is **503**, inspect logs:

```bash
docker compose logs api
docker compose logs postgres redis minio
```

### 6.3 Authentication smoke test

Confirm the auth service responds (Phase 0 JWT login).

**Development seed users** (change before production handoff):

| Email | Default password | Role |
|-------|------------------|------|
| `admin@arcncode.local` | `Admin123!` | Admin |
| `manager@arcncode.local` | `Manager123!` | Manager |

Login test:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@arcncode.local","password":"Admin123!"}'
```

**Pass criteria:**

- HTTP status **201** (or 200)
- Response includes `accessToken` and `refreshToken`

Role-gated endpoint test (use token from login response):

```bash
curl -s http://localhost:3000/api/auth/admin-only \
  -H "Authorization: Bearer <accessToken>"
```

**Pass criteria:** HTTP **200** with admin access message.

- [ ] Login returns JWT tokens
- [ ] Admin-only endpoint accepts Admin token

### 6.4 Server readiness sign-off

- [ ] Stack boots automatically after server reboot (verify once if time permits)
- [ ] Backup script location documented: `scripts/backup.sh` (see `docs/backup-restore-runbook.md`)
- [ ] Customer knows support URL / contact for Arc N Code

**Verification completed by:** _________________________  
**Time:** _________________________

---

## 7. Troubleshooting quick reference

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `/api/health` 503 on postgres | DB container not ready | `docker compose logs postgres`; wait for healthcheck |
| `/api/health` 503 on redis | Redis not running | `docker compose restart redis` |
| `/api/health` 503 on minio | Bucket/endpoint mismatch | Check `MINIO_*` env vars in `.env` |
| Cannot reach API from Office | Firewall / wrong VLAN | Verify ACL rules Section 2.2 |
| Login 401 | Wrong password or seed not run | Run `npm run prisma:seed` or reset credentials |
| Containers exit on boot | Port conflict or bad `.env` | `docker compose logs api` |

---

## 8. Document control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-19 | Arc N Code | Initial Phase 0.5 SOP |

**Related documents:**

- [README.md](../README.md) — local development and API overview
- [backup-restore-runbook.md](./backup-restore-runbook.md) — database backup/restore
- [Arc_N_Code_AI_Build_Prompts_v6.md](../Arc_N_Code_AI_Build_Prompts_v6.md) — full build sequence

**Open item:** Automated site provisioning token / registry API — **Phase 1+** (see Section 4).
