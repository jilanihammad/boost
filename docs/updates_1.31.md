Boost RBAC Implementation Plan

 Goal

 Implement full Role-Based Access Control (RBAC) with three-tier role hierarchy: owner > merchant_admin 
 > staff

 ---
 Role Hierarchy & Permissions

 | Role           | Scope           | Permissions
                               |
 |----------------|-----------------|-------------------------------------------------------------------
 ------------------------------|
 | owner          | Global          | All permissions. Create/edit/delete merchants. Create co-owners.
 Impersonate any merchant view. |
 | merchant_admin | Single merchant | Create offers, generate QR codes, edit merchant profile, invite
 staff, view as staff.           |
 | staff          | Single merchant | Redeem tokens, view dashboard + redemptions (read-only).
                               |

 Account Structure

 - One merchant_admin per merchant
 - Multiple staff per merchant
 - First owner: jilanihammad@gmail.com (bootstrap via script)

 View Hierarchy (Impersonation - UI Only)

 - Owner → can view as merchant_admin or staff
 - Merchant Admin → can view as staff
 - Staff → staff view only

 ---
 Firebase Custom Claims Structure

 {
   "role": "owner" | "merchant_admin" | "staff",
   "merchant_id": "merchant_abc123",  // null for owner
   "is_primary": true  // only for primary owner (jilanihammad@gmail.com)
 }

 Primary Owner Protection: The primary owner (is_primary: true) cannot be deleted by other owners.

 ---
 New Firestore Collections

 users/{uid}

 email: string
 role: "owner" | "merchant_admin" | "staff"
 merchant_id: string | null
 created_at: timestamp
 created_by: string (uid of inviter)
 status: "active" | "deleted"

 pending_roles/{id}

 email: string
 role: "merchant_admin" | "staff"
 merchant_id: string
 created_by: string (uid)
 created_at: timestamp
 expires_at: timestamp  // created_at + 7 days
 claimed: boolean

 Invite Expiration: Pending invites expire after 7 days. Backend validates expires_at before applying
 claims.

 Update merchants/{id}

 Add fields:
 status: "active" | "deleted"  // soft delete support
 deleted_at: timestamp | null
 deleted_by: string | null  // uid of owner who deleted

 Soft Delete Behavior: Deleted merchants appear grayed out in owner's list with "Restore" button. Owner
 can undo deletion.

 ---
 Implementation Steps

 Step 1: Backend Role Infrastructure

 Files: apps/api/app/auth.py, apps/api/app/deps.py

 Add role helper functions:
 def set_user_claims(uid: str, role: str, merchant_id: str | None = None):
     """Set Firebase custom claims (owner only can call)."""
     claims = {"role": role}
     if merchant_id:
         claims["merchant_id"] = merchant_id
     auth.set_custom_user_claims(uid, claims)

 def require_owner(user: dict):
     if user.get("role") != "owner":
         raise HTTPException(403, "Owner access required")

 def require_merchant_admin(user: dict, merchant_id: str):
     role = user.get("role")
     if role == "owner":
         return
     if role == "merchant_admin" and user.get("merchant_id") == merchant_id:
         return
     raise HTTPException(403, "Merchant admin access required")

 def require_staff_or_above(user: dict, merchant_id: str):
     role = user.get("role")
     if role == "owner":
         return
     if role in ("merchant_admin", "staff") and user.get("merchant_id") == merchant_id:
         return
     raise HTTPException(403, "Access denied")

 Step 2: Update API Endpoint Guards

 File: apps/api/app/main.py

 | Endpoint                 | Current Guard     | New Guard                                            |
 |--------------------------|-------------------|------------------------------------------------------|
 | POST /merchants          | require_admin     | require_owner                                        |
 | PATCH /merchants/{id}    | require_admin     | require_owner OR require_merchant_admin(merchant_id) |
 | DELETE /merchants/{id}   | require_admin     | require_owner (soft delete)                          |
 | POST /offers             | require_admin     | require_owner OR require_merchant_admin              |
 | PATCH /offers/{id}       | require_admin     | require_owner OR require_merchant_admin              |
 | DELETE /offers/{id}      | require_admin     | require_owner OR require_merchant_admin              |
 | POST /offers/{id}/tokens | require_admin     | require_owner OR require_merchant_admin              |
 | POST /redeem             | any authenticated | require_staff_or_above                               |
 | GET /redemptions         | scoped by role    | require_staff_or_above (scoped)                      |
 | GET /ledger              | scoped by role    | require_staff_or_above (scoped)                      |

 Step 3: Add Role Assignment Endpoints

 File: apps/api/app/main.py

 POST /admin/users
   - Owner only
   - Body: { email, role, merchant_id }
   - If user exists in Firebase: set claims immediately
   - If user doesn't exist: create pending_roles document
   - Return: { user_id, status: "claimed" | "pending" }

 POST /auth/claim-role
   - Any authenticated user
   - Check pending_roles for user's email
   - Apply pending role claims
   - Create users/ document
   - Mark pending_roles as claimed
   - Return: { success, role, merchant_id }

 GET /admin/users?merchant_id=...
   - Owner: see all users
   - Merchant admin: see users for their merchant
   - Return: list of users with roles

 DELETE /admin/users/{uid}
   - Owner: can delete any user except primary owner
   - Merchant admin: can delete staff for their merchant only
   - Cannot delete primary owner (is_primary: true)
   - Soft delete: clear claims, mark user as deleted

 PATCH /merchants/{id}/restore
   - Owner only
   - Set status back to "active", clear deleted_at/deleted_by
   - Note: Does NOT restore orphaned users (they must be re-invited)

 Step 4: Owner Bootstrap Script

 File: apps/api/scripts/bootstrap_owner.py

 #!/usr/bin/env python3
 """Bootstrap first owner account (primary owner)."""
 import firebase_admin
 from firebase_admin import auth

 OWNER_EMAIL = "jilanihammad@gmail.com"

 def bootstrap():
     firebase_admin.initialize_app()
     user = auth.get_user_by_email(OWNER_EMAIL)
     auth.set_custom_user_claims(user.uid, {
         "role": "owner",
         "is_primary": True  # Cannot be deleted by other owners
     })
     print(f"Set PRIMARY owner role for {OWNER_EMAIL} (uid: {user.uid})")

 if __name__ == "__main__":
     bootstrap()

 Run once after deployment: python scripts/bootstrap_owner.py

 Step 5: Update Frontend Auth Context

 File: apps/web/src/lib/auth.tsx

 type AppRole = "owner" | "merchant_admin" | "staff";

 interface AuthState {
   user: User | null;
   loading: boolean;
   role: AppRole | null;
   merchantId: string | null;
   idToken: string | null;

   // Impersonation (UI only)
   viewAs: "merchant_admin" | "staff" | null;
   setViewAs: (view: "merchant_admin" | "staff" | null) => void;
   effectiveRole: AppRole | null;  // role with viewAs applied

   // Auth methods
   signInWithGoogle: () => Promise<void>;
   sendEmailLink: (email: string) => Promise<void>;
   tryCompleteEmailLinkSignIn: () => Promise<void>;
   signOut: () => Promise<void>;

   // Force token refresh (after claim-role)
   refreshToken: () => Promise<void>;
 }

 Add token refresh after claiming role:
 const refreshToken = async () => {
   if (user) {
     await user.getIdToken(true);  // force refresh
     const tokenResult = await user.getIdTokenResult();
     setRole(tokenResult.claims.role as AppRole);
     setMerchantId(tokenResult.claims.merchant_id as string | null);
   }
 };

 Step 6: Update RequireRole Component

 File: apps/web/src/components/RequireRole.tsx

 Support impersonation in role checks:
 export function RequireRole({ allow, children }: { allow: AppRole[]; children: ReactNode }) {
   const { loading, user, effectiveRole } = useAuth();

   // Use effectiveRole (considers viewAs) instead of actual role
   if (!allow.includes(effectiveRole)) {
     return <Redirect to="/dashboard" />;
   }

   return <>{children}</>;
 }

 Step 7: Create Claim Role Page

 File: apps/web/src/app/claim-role/page.tsx

 Flow:
 1. User clicks magic link → lands on /claim-role
 2. Page calls POST /auth/claim-role
 3. Backend sets claims from pending_roles
 4. Frontend calls refreshToken()
 5. Redirect to appropriate dashboard based on role

 Step 8: Update Login Page Routing

 File: apps/web/src/app/login/page.tsx

 After successful login, route based on role:
 useEffect(() => {
   if (user && role) {
     if (role === "owner") {
       router.push("/admin");
     } else {
       router.push("/dashboard");
     }
   }
 }, [user, role]);

 Step 9: Owner Admin Panel Updates

 File: apps/web/src/app/admin/page.tsx

 Add new tabs:
 1. Merchants (existing) - Create/edit/delete merchants
 2. Offers (existing) - Manage offers
 3. QR Codes (existing) - Generate tokens
 4. Users (NEW) - Role assignments
   - Invite merchant_admin by email
   - Invite staff by email (select merchant)
   - View all users with roles
   - View pending invites
   - Delete/deactivate users

 Add merchant impersonation:
 - "View as" button on each merchant row
 - Sets viewAs state and merchantId context
 - Shows merchant's dashboard/redeem view

 Step 10: Merchant Admin Dashboard Updates

 File: apps/web/src/app/dashboard/page.tsx

 - Add "View as Staff" toggle in header (merchant_admin only)
 - When toggled: hide offer management, show read-only view
 - Staff invite found naturally in admin/settings (no first-time prompt)

 Step 11: Merchant Deletion (Soft Delete)

 File: apps/api/app/main.py

 DELETE /merchants/{id}
   - Set merchant.status = "deleted"
   - For each user with merchant_id:
     - Clear their Firebase claims (role=null, merchant_id=null)
     - Set user.status = "orphaned" in Firestore
   - Return: { deleted: true, orphaned_users: count }

 ---
 Files to Modify/Create

 Backend

 | File                       | Action | Changes                                                   |
 |----------------------------|--------|-----------------------------------------------------------|
 | app/auth.py                | Modify | Add set_user_claims, role check helpers                   |
 | app/deps.py                | Modify | Update user extraction                                    |
 | app/main.py                | Modify | Update all endpoint guards, add user management endpoints |
 | app/models.py              | Modify | Add User, PendingRole models                              |
 | app/db.py                  | Modify | Add USERS, PENDING_ROLES constants                        |
 | scripts/bootstrap_owner.py | Create | First owner setup script                                  |

 Frontend

 | File                       | Action | Changes                                  |
 |----------------------------|--------|------------------------------------------|
 | lib/auth.tsx               | Modify | Add viewAs, effectiveRole, refreshToken  |
 | lib/api.ts                 | Modify | Add user management API calls            |
 | components/RequireRole.tsx | Modify | Support effectiveRole                    |
 | app/login/page.tsx         | Modify | Role-based routing                       |
 | app/claim-role/page.tsx    | Create | Handle invite acceptance                 |
 | app/admin/page.tsx         | Modify | Add Users tab, impersonation             |
 | app/dashboard/page.tsx     | Modify | Add staff view toggle, first-time prompt |

 ---
 Testing Checklist

 Owner Flow

 - Bootstrap script sets PRIMARY owner role for jilanihammad@gmail.com
 - Owner can login and see admin panel
 - Owner can create merchant with merchant_admin
 - Owner can invite merchant_admin by email
 - Owner can create additional (non-primary) owners
 - Owner can impersonate merchant view
 - Owner can soft-delete merchant (shows grayed out)
 - Owner can restore soft-deleted merchant
 - Primary owner cannot be deleted by other owners

 Merchant Admin Flow

 - Invited merchant_admin receives magic link
 - Clicking link completes sign-in and sets claims
 - Expired invite (>7 days) shows error
 - Merchant admin sees their dashboard
 - Merchant admin can create offers
 - Merchant admin can invite staff
 - Merchant admin can delete their own staff
 - Merchant admin can toggle "view as staff"

 Staff Flow

 - Invited staff receives magic link
 - Staff can redeem tokens
 - Staff can view dashboard (read-only)
 - Staff cannot access offer management

 Permission Boundaries

 - Staff cannot create offers (403)
 - Merchant admin cannot access other merchants (403)
 - Merchant admin cannot delete merchant (403)
 - Merchant admin cannot delete other merchant's staff (403)
 - Non-primary owner cannot delete primary owner (403)
 - Orphaned user (from deleted merchant) sees "No merchant assigned" message
