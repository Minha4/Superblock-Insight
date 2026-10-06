import sys
import os
import json
import sqlite3
import base64
import ctypes
from decimal import Decimal
import datetime

# Priority order for python libraries
libs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "libs")
if os.path.exists(libs_dir):
    sys.path.insert(0, libs_dir)
sys.path.insert(0, r"C:\Users\Dell\.gemini\antigravity\brain\28242150-d902-4ec3-87a8-424a02ad0a45\scratch\libs")

import pg8000.dbapi
from ctypes import wintypes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher
from cryptography.hazmat.primitives.ciphers.algorithms import AES
from cryptography.hazmat.decrepit.ciphers.modes import CFB8

def get_credentials():
    # 1. Environment variables if present
    host = os.environ.get("PGHOST")
    port = int(os.environ.get("PGPORT", 5433))
    dbname = os.environ.get("PGDATABASE", "superblockhq")
    user = os.environ.get("PGUSER")
    password = os.environ.get("PGPASSWORD")
    
    if not (host and user and password):
        padding_string = b'}'
        iv_size = AES.block_size // 8
        def pad(key):
            if isinstance(key, str): key = key.encode()
            key = key[:32]
            if len(key) in (16, 24, 32): return key
            return key.ljust(32, padding_string)
        def decrypt(ciphertext, key):
            ciphertext = base64.b64decode(ciphertext)
            iv = ciphertext[:iv_size]
            cipher = Cipher(AES(pad(key)), CFB8(iv), default_backend())
            decryptor = cipher.decryptor()
            return decryptor.update(ciphertext[iv_size:]) + decryptor.finalize()

        class CREDENTIAL(ctypes.Structure):
            _fields_ = [
                ('Flags', wintypes.DWORD), ('Type', wintypes.DWORD),
                ('TargetName', wintypes.LPWSTR), ('Comment', wintypes.LPWSTR),
                ('LastWritten', wintypes.FILETIME), ('CredentialBlobSize', wintypes.DWORD),
                ('CredentialBlob', ctypes.POINTER(ctypes.c_byte)), ('Persist', wintypes.DWORD),
                ('AttributeCount', wintypes.DWORD), ('Attributes', ctypes.c_void_p),
                ('TargetAlias', wintypes.LPWSTR), ('UserName', wintypes.LPWSTR),
            ]

        pcred = ctypes.POINTER(CREDENTIAL)()
        ctypes.windll.advapi32.CredReadW('pgAdmin4', 1, 0, ctypes.byref(pcred))
        blob = ctypes.string_at(pcred.contents.CredentialBlob, pcred.contents.CredentialBlobSize)
        master_key = blob.decode('utf-16-le')
        ctypes.windll.advapi32.CredFree(pcred)

        con = sqlite3.connect(r'C:\Users\Dell\AppData\Roaming\pgadmin\pgadmin4.db')
        row = con.cursor().execute(
            "SELECT host, port, maintenance_db, username, password FROM server WHERE name='superblock'"
        ).fetchone()
        if row:
            host, port, _maint_db, user, hex_enc_pass = row
            password = decrypt(bytes.fromhex(hex_enc_pass).decode('utf-8'), master_key).decode('utf-8')
        con.close()
        dbname = os.environ.get("PGDATABASE", "superblockhq")

    return {
        "host": host or "127.0.0.1",
        "port": port,
        "dbname": dbname,
        "user": user or "superblockhq",
        "password": password
    }

def get_connection():
    creds = get_credentials()
    return pg8000.dbapi.connect(
        host=creds["host"],
        port=creds["port"],
        database=creds["dbname"],
        user=creds["user"],
        password=creds["password"]
    )

def format_activity_time(dt):
    if not dt:
        return "—"
    return dt.strftime("%d %b · %H:%M")

def format_product_date(dt):
    if not dt:
        return "—"
    return dt.strftime("%d %b %Y")

def format_price(price):
    if price is None:
        return "0"
    num = float(price)
    if num.is_integer():
        return f"{int(num):,}"
    return f"{num:,.2f}"

def format_activity_type(action):
    if not action:
        return "General"
    cleaned = action.replace("_", " ").strip()
    return " ".join(w.capitalize() for w in cleaned.split())

def fetch_all():
    conn = get_connection()
    cur = conn.cursor()

    # 1. Activities
    cur.execute("""
    SELECT 
        ca.id::text,
        ca.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        ca.source_activity_id,
        ca.action,
        ca.action_text,
        ca.description,
        ca.message,
        ca.status,
        ca.priority,
        ca.task_title,
        ca.user_id AS actor_user_id,
        ca.user_name AS actor_user_name,
        ca.created_at
    FROM public.customer_activities ca
    JOIN public.customers_details c ON ca.customer_id = c.id
    LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name) 
                             OR LOWER(c.client_user_id) = LOWER(u.email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
    ORDER BY ca.created_at DESC;
    """)

    activities = []
    for r in cur.fetchall():
        (ca_id, cust_id, client_uid, cognito_uid, cust_name, source_act_id, action,
         action_text, description, message, status, priority, task_title,
         actor_uid, actor_uname, created_at) = r

        title = task_title or action_text or "Activity"
        act_type = format_activity_type(action)
        detail = description or message or "—"
        time_str = format_activity_time(created_at)
        actor = actor_uname or actor_uid or "System"
        channel = status or None

        activities.append({
            "id": ca_id,
            "customerId": cust_id,
            "clientUserId": client_uid,
            "cognitoUserId": cognito_uid,
            "customerName": cust_name,
            "title": title,
            "type": act_type,
            "detail": detail,
            "time": time_str,
            "actor": actor,
            "channel": channel,
        })

    # 2. Products
    cur.execute("""
    SELECT 
        cp.id::text,
        cp.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        cp.source_product_id,
        cp.name,
        cp.description,
        cp.category,
        cp.billing,
        cp.price,
        cp.stock,
        cp.active,
        cp.created_at
    FROM public.customer_products cp
    JOIN public.customers_details c ON cp.customer_id = c.id
    LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name) 
                             OR LOWER(c.client_user_id) = LOWER(u.email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
    ORDER BY cp.created_at DESC;
    """)

    products = []
    for r in cur.fetchall():
        (cp_id, cust_id, client_uid, cognito_uid, cust_name, source_prod_id,
         name, description, category, billing, price, stock, active, created_at) = r

        status = "Active" if active else "Paused"
        pricing_str = f"₹{format_price(price)}"
        if billing:
            pricing_str += f" / {billing}"
        
        qty_str = f"{int(stock)} units" if stock is not None else "—"
        start_date = format_product_date(created_at)
        owner = category or "System"

        products.append({
            "id": cp_id,
            "customerId": cust_id,
            "clientUserId": client_uid,
            "cognitoUserId": cognito_uid,
            "customerName": cust_name,
            "name": name or "Unnamed Product",
            "description": description or "—",
            "status": status,
            "startDate": start_date,
            "expiryDate": "—",
            "quantity": qty_str,
            "pricing": pricing_str,
            "notes": "—",
            "owner": owner,
        })

    # 3. Deals
    cur.execute("""
    SELECT 
        cd.id::text,
        cd.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        cd.source_deal_id,
        cd.name,
        cd.title,
        cd.numeric_value,
        cd.currency,
        cd.probability,
        cd.stage,
        cd.status,
        cd.pipeline_name,
        cd.owner_name,
        cd.last_activity_at,
        cd.created_at
    FROM public.customer_deals cd
    JOIN public.customers_details c ON cd.customer_id = c.id
    LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name) 
                             OR LOWER(c.client_user_id) = LOWER(u.email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
    ORDER BY cd.created_at DESC;
    """)
    deals = []
    for r in cur.fetchall():
        (d_id, cust_id, client_uid, cognito_uid, cust_name, source_deal_id,
         name, title, num_val, curr, prob, stage, status, pipe_name, owner, last_act, created_at) = r
        deals.append({
            "id": d_id,
            "customerId": cust_id,
            "clientUserId": client_uid,
            "cognitoUserId": cognito_uid,
            "customerName": cust_name,
            "sourceDealId": source_deal_id,
            "name": name or title or "Unnamed Deal",
            "title": title or name or "Unnamed Deal",
            "value": float(num_val) if num_val is not None else 0.0,
            "formattedValue": format_price(num_val),
            "currency": curr or "INR",
            "probability": float(prob) if prob is not None else 0.0,
            "stage": stage or "Lead",
            "status": status or "Open",
            "pipelineName": pipe_name or "Standard",
            "owner": owner or "System",
            "createdDate": format_product_date(created_at),
            "lastActivityDate": format_product_date(last_act),
        })

    # 4. Tasks
    cur.execute("""
    SELECT 
        ct.id::text,
        ct.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        ct.source_task_id,
        ct.title,
        ct.description,
        ct.status,
        ct.priority,
        ct.due_date,
        ct.created_by,
        ct.created_at
    FROM public.customer_tasks ct
    JOIN public.customers_details c ON ct.customer_id = c.id
    LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name) 
                             OR LOWER(c.client_user_id) = LOWER(u.email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
    ORDER BY ct.created_at DESC;
    """)
    tasks = []
    for r in cur.fetchall():
        (t_id, cust_id, client_uid, cognito_uid, cust_name, source_task_id,
         title, desc, status, priority, due_date, created_by, created_at) = r
        tasks.append({
            "id": t_id,
            "customerId": cust_id,
            "clientUserId": client_uid,
            "cognitoUserId": cognito_uid,
            "customerName": cust_name,
            "sourceTaskId": source_task_id,
            "title": title or "Task",
            "description": desc or "—",
            "status": status or "To do",
            "priority": (priority or "Medium").capitalize(),
            "dueDate": str(due_date) if due_date else "—",
            "createdBy": created_by or "SuperBlock Admin",
            "createdDate": format_product_date(created_at),
        })

    # 5. Tickets with Replies
    cur.execute("""
    SELECT 
        ticket_id,
        source_reply_id,
        user_name,
        user_email,
        message,
        created_at
    FROM public.customer_ticket_replies
    ORDER BY created_at ASC;
    """)
    replies_by_ticket = {}
    for r in cur.fetchall():
        t_id, rep_id, u_name, u_email, msg, rep_created = r
        if t_id not in replies_by_ticket:
            replies_by_ticket[t_id] = []
        replies_by_ticket[t_id].append({
            "id": rep_id,
            "userName": u_name or u_email or "Agent",
            "message": msg or "",
            "createdAt": format_product_date(rep_created)
        })

    cur.execute("""
    SELECT 
        tk.id::text,
        tk.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        tk.source_ticket_id,
        tk.user_id,
        tk.user_name,
        tk.user_email,
        tk.title,
        tk.subject,
        tk.description,
        tk.category,
        tk.priority,
        tk.status,
        tk.created_at
    FROM public.customer_tickets tk
    JOIN public.customers_details c ON tk.customer_id = c.id
    LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name) 
                             OR LOWER(c.client_user_id) = LOWER(u.email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
    ORDER BY tk.created_at DESC;
    """)
    tickets = []
    for r in cur.fetchall():
        (tk_id, cust_id, client_uid, cognito_uid, cust_name, source_ticket_id,
         u_id, u_name, u_email, title, subject, desc, cat, priority, status, created_at) = r
        reps = replies_by_ticket.get(source_ticket_id, [])
        tickets.append({
            "id": tk_id,
            "customerId": cust_id,
            "clientUserId": client_uid,
            "cognitoUserId": cognito_uid,
            "customerName": cust_name,
            "sourceTicketId": source_ticket_id,
            "title": title or subject or "Support Ticket",
            "description": desc or "—",
            "category": cat or "Support",
            "priority": (priority or "Medium").capitalize(),
            "status": status or "Open",
            "createdBy": u_name or u_email or "Customer",
            "createdDate": format_product_date(created_at),
            "replies": reps
        })

    # 6. Contact Groups
    cur.execute("""
    SELECT 
        cg.id::text,
        cg.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        cg.source_group_id,
        cg.group_name,
        cg.channels,
        cg.total_count,
        cg.created_at
    FROM public.customer_contact_groups cg
    JOIN public.customers_details c ON cg.customer_id = c.id
    LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name) 
                             OR LOWER(c.client_user_id) = LOWER(u.email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
    ORDER BY cg.total_count DESC, cg.created_at DESC;
    """)
    groups = []
    for r in cur.fetchall():
        (g_id, cust_id, client_uid, cognito_uid, cust_name, source_grp_id,
         grp_name, chs, total_count, created_at) = r
        groups.append({
            "id": g_id,
            "customerId": cust_id,
            "clientUserId": client_uid,
            "cognitoUserId": cognito_uid,
            "customerName": cust_name,
            "sourceGroupId": source_grp_id,
            "name": grp_name,
            "channels": chs,
            "totalCount": int(total_count) if total_count is not None else 0,
            "createdDate": format_product_date(created_at),
        })

    # 7. Notes
    cur.execute("""
    SELECT 
        n.id::text,
        n.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        n.title,
        n.content,
        n.created_by::text,
        n.created_at,
        n.updated_at
    FROM public.notes n
    JOIN public.customers_details c ON n.customer_id = c.id
    LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name) 
                             OR LOWER(c.client_user_id) = LOWER(u.email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_email)
                             OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
    ORDER BY n.created_at DESC;
    """)
    notes = []
    for r in cur.fetchall():
        (n_id, cust_id, client_uid, cognito_uid, cust_name,
         title, content, created_by, created_at, updated_at) = r
        notes.append({
            "id": n_id,
            "customerId": cust_id,
            "clientUserId": client_uid,
            "cognitoUserId": cognito_uid,
            "customerName": cust_name,
            "title": title or "Internal Note",
            "content": content or "",
            "createdBy": created_by or "SuperBlock Team",
            "createdDate": format_product_date(created_at),
            "updatedAt": format_product_date(updated_at),
        })

    conn.close()
    return {
        "success": True,
        "activities": activities,
        "products": products,
        "deals": deals,
        "tasks": tasks,
        "tickets": tickets,
        "groups": groups,
        "notes": notes
    }

class SafeJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if hasattr(obj, 'hex'):
            return str(obj)
        return super().default(obj)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("--get-password", "-p"):
        try:
            creds = get_credentials()
            p = creds.get("password") or ""
            print(p.decode("utf-8") if isinstance(p, bytes) else str(p))
            sys.exit(0)
        except Exception as e:
            sys.stderr.write(f"Error: {e}\n")
            sys.exit(1)

    if len(sys.argv) > 1 and sys.argv[1] in ("--credentials", "-c"):
        try:
            creds = get_credentials()
            p = creds.get("password") or ""
            creds["password"] = p.decode("utf-8") if isinstance(p, bytes) else str(p)
            print(json.dumps(creds))
            sys.exit(0)
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            sys.exit(1)

    try:
        res = fetch_all()
        print(json.dumps(res, cls=SafeJSONEncoder))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
