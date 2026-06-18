# BunziMeal API Documentation

## Base URL
All endpoints are under `/api/v1` (or your configured base path).

---

## Table of Contents
1. [Auth](#auth)
2. [Users](#users)
3. [Health Engagement](#health-engagement)
4. [Notifications](#notifications)
5. [Nutrition](#nutrition)
6. [Pantry](#pantry)
7. [Shopping List](#shopping-list)
8. [AI Chat](#ai-chat)
9. [Billing](#billing)
10. [Localization](#localization)
11. [Referrals](#referrals)
12. [Content (Public)](#content-public)
13. [Admin](#admin)


---

## Auth

### Register
- **Method**: `POST`
- **URL**: `/auth/register`
- **Required Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  { "email": "user@example.com", "password": "strongPass123!", "first_name": "John", "last_name": "Doe" }
  ```
- **Success Response**: `201 Created`
  ```json
  { "user": { "id": "...", "email": "...", "first_name": "...", "last_name": "...", "role": "user" }, "access_token": "...", "refresh_token": "..." }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `409 Conflict`: User already exists

### Login
- **Method**: `POST`
- **URL**: `/auth/login`
- **Required Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  { "email": "user@example.com", "password": "strongPass123!" }
  ```
- **Success Response**: `200 OK`
  ```json
  { "user": { "id": "...", "email": "...", "first_name": "...", "last_name": "...", "role": "user" }, "access_token": "...", "refresh_token": "..." }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: Invalid credentials

### Refresh Token
- **Method**: `POST`
- **URL**: `/auth/refresh`
- **Required Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  { "refresh_token": "..." }
  ```
- **Success Response**: `200 OK`
  ```json
  { "access_token": "..." }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid refresh token
  - `401 Unauthorized`: Invalid or expired token

### Send OTP
- **Method**: `POST`
- **URL**: `/auth/otp/send`
- **Required Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  { "email": "user@example.com" }
  ```
- **Success Response**: `200 OK`
  ```json
  { "success": true, "message": "OTP sent successfully" }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data

### Verify OTP
- **Method**: `POST`
- **URL**: `/auth/otp/verify`
- **Required Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  { "email": "user@example.com", "code": "123456" }
  ```
- **Success Response**: `200 OK`
  ```json
  { "success": true, "message": "OTP verified" }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid OTP

---

## Users

### Get My Profile
- **Method**: `GET`
- **URL**: `/users/me`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "id": "...", "email": "...", "first_name": "...", "last_name": "...", "country": {...}, "profile": {...} }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Update My Profile
- **Method**: `PATCH`
- **URL**: `/users/me`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "first_name": "Jane", "last_name": "Smith", "country_id": 126 }
  ```
- **Success Response**: `200 OK`
  ```json
  { "id": "...", "email": "...", "first_name": "Jane", "last_name": "Smith", ... }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token

---

## Health Engagement

### Get Streak
- **Method**: `GET`
- **URL**: `/health/streak`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "current": 5, "best": 10 }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Get Goals
- **Method**: `GET`
- **URL**: `/health/goals`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  [ { "id": 1, "type": "weight_loss", "target": 70, "current": 75, "created_at": "...", "updated_at": "..." } ]
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Create Goal
- **Method**: `POST`
- **URL**: `/health/goals`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "type": "weight_loss", "target": 70 }
  ```
- **Success Response**: `201 Created`
  ```json
  { "id": 1, "type": "weight_loss", "target": 70, ... }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token

### Update Goal
- **Method**: `PATCH`
- **URL**: `/health/goals/:id`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "target": 68 }
  ```
- **Success Response**: `200 OK`
  ```json
  { "id": 1, "type": "weight_loss", "target": 68, ... }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token
  - `404 Not Found`: Goal not found

### Delete Goal
- **Method**: `DELETE`
- **URL**: `/health/goals/:id`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "success": true }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token
  - `404 Not Found`: Goal not found

---

## Notifications

### List My Notifications
- **Method**: `GET`
- **URL**: `/notifications`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  [ { "id": 1, "type": "goal_reminder", "title": "...", "body": "...", "read": false, "created_at": "..." } ]
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Mark as Read
- **Method**: `PATCH`
- **URL**: `/notifications/:id/read`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "id": 1, "read": true, ... }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token
  - `404 Not Found`: Notification not found

---

## Nutrition

### Get My Stats
- **Method**: `GET`
- **URL**: `/nutrition/stats`
- **Query Parameters**: `from=YYYY-MM-DD`, `to=YYYY-MM-DD`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  [ { "id": 1, "stat_date": "2026-06-18", "calories": 2000, "protein_grams": 150, "carbs_grams": 200, "fat_grams": 60 } ]
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Create/Update Stat
- **Method**: `POST`
- **URL**: `/nutrition/stats`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "stat_date": "2026-06-18", "calories": 2000, "protein_grams": 150, "carbs_grams": 200, "fat_grams": 60 }
  ```
- **Success Response**: `201 Created`
  ```json
  { "id": 1, ... }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token

### Delete Stat
- **Method**: `DELETE`
- **URL**: `/nutrition/stats/:id`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "deleted": true }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token
  - `404 Not Found`: Stat not found

---

## Pantry

### Get My Pantry Items
- **Method**: `GET`
- **URL**: `/pantry`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  [ { "id": 1, "name": "Apple", "quantity": 5, "unit": "pcs", "expires_at": "...", "created_at": "..." } ]
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Add Item to Pantry
- **Method**: `POST`
- **URL**: `/pantry`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "name": "Banana", "quantity": 10, "unit": "pcs", "expires_at": "2026-07-01" }
  ```
- **Success Response**: `201 Created`
  ```json
  { "id": 2, ... }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token

### Update Item
- **Method**: `PATCH`
- **URL**: `/pantry/:id`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "quantity": 8 }
  ```
- **Success Response**: `200 OK`
  ```json
  { "id": 2, "quantity": 8, ... }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token
  - `404 Not Found`: Item not found

### Delete Item
- **Method**: `DELETE`
- **URL**: `/pantry/:id`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "deleted": true }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token
  - `404 Not Found`: Item not found

---

## Shopping List

### Get My Shopping List
- **Method**: `GET`
- **URL**: `/shopping-list`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  [ { "id": 1, "name": "Milk", "quantity": 2, "unit": "L", "purchased": false } ]
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Add Item
- **Method**: `POST`
- **URL**: `/shopping-list`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "name": "Eggs", "quantity": 12, "unit": "pcs" }
  ```
- **Success Response**: `201 Created`
  ```json
  { "id": 2, ... }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token

### Mark as Purchased
- **Method**: `PATCH`
- **URL**: `/shopping-list/:id/purchase`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "id": 1, "purchased": true, ... }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token
  - `404 Not Found`: Item not found

### Delete Item
- **Method**: `DELETE`
- **URL**: `/shopping-list/:id`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "deleted": true }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token
  - `404 Not Found`: Item not found

---

## AI Chat

### Send Chat Message
- **Method**: `POST`
- **URL**: `/ai/chat`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "message": "Suggest a low-carb dinner", "persona": "nutrition_coach" }
  ```
- **Success Response**: `200 OK`
  ```json
  { "response": "How about grilled salmon with asparagus..." }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token

---

## Billing

### Get Public Plan
- **Method**: `GET`
- **URL**: `/billing/public-plan`
- **Query Parameters**: `country_id=126`, `code=NG`
- **Required Headers**: None
- **Success Response**: `200 OK`
  ```json
  { "is_active": true, "country": { "id": 126, "currency": "NGN" }, "plans": [ { "plan": "monthly", "price_cents": 100000, "currency": "NGN" }, ... ] }
  ```
- **Error States**:
  - `404 Not Found`: Plan not available for country

### Get My Plans
- **Method**: `GET`
- **URL**: `/billing/plans`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "is_active": true, "country": { ... }, "plans": [...] }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Get Subscription Status
- **Method**: `GET`
- **URL**: `/billing/status`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "is_active": true, "is_trialing": false, "next_billing_date": "2026-07-18", "subscription": {...} }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Convert Currency
- **Method**: `GET`
- **URL**: `/billing/convert`
- **Query Parameters**: `from=USD`, `amount=100`
- **Required Headers**: None
- **Success Response**: `200 OK`
  ```json
  { "rate": 1500, "converted_major": 150000, "converted_cents": 15000000, "raw": {...} }
  ```

### Checkout
- **Method**: `POST`
- **URL**: `/billing/checkout`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "plan": "monthly", "referral_code": "ABCD123", "callback_url": "https://example.com/success" }
  ```
- **Success Response**: `200 OK`
  ```json
  { "reference": "bunzi-abc123", "authorization_url": "https://paystack.com/..." }
  ```
  OR (if trial applied):
  ```json
  { "trial_applied": true, "trial_days": 14 }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token

---

## Localization

### List Countries
- **Method**: `GET`
- **URL**: `/localization/countries`
- **Required Headers**: None
- **Success Response**: `200 OK`
  ```json
  [ { "id": 126, "name": "Nigeria", "code": "NG", "currency": "NGN" }, ... ]
  ```

---

## Referrals

### Validate Referral Code
- **Method**: `GET`
- **URL**: `/referrals/validate`
- **Query Parameters**: `code=ABCD123`
- **Required Headers**: None
- **Success Response**: `200 OK`
  ```json
  { "valid": true, "affiliate": { "name": "Affiliate Name", "code": "ABCD123", "benefit": "percent_discount", "benefit_value": 50, "cap": 100, "active": true } }
  ```
- **Error States**:
  - `404 Not Found`: Invalid code

### Redeem Referral Code
- **Method**: `POST`
- **URL**: `/referrals/redeem`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "code": "ABCD123" }
  ```
- **Success Response**: `200 OK`
  ```json
  { "message": "redeemed", "affiliate": {...} }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid/inactive/expired code
  - `401 Unauthorized`: No valid token
  - `409 Conflict`: Already redeemed

### Request Affiliate Status
- **Method**: `POST`
- **URL**: `/referrals/request`
- **Required Headers**: `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "pitch": "I love your product!", "social_links": ["https://twitter.com/me"] }
  ```
- **Success Response**: `201 Created`
  ```json
  { "id": "...", "status": "pending", "pitch": "...", "social_links": [...] }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token
  - `409 Conflict`: Request already exists

### Get My Referral Status
- **Method**: `GET`
- **URL**: `/referrals/status`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "request": { ... }, "affiliate": { ... }, "code": "ABCD123" }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

### Get My Referral Stats
- **Method**: `GET`
- **URL**: `/referrals/stats`
- **Required Headers**: `Authorization: Bearer <access_token>`
- **Success Response**: `200 OK`
  ```json
  { "total": 10, "applied": 5, "code": "ABCD123" }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token

---

## Content (Public)

### Get Site Contents
- **Method**: `GET`
- **URL**: `/content`
- **Required Headers**: None
- **Success Response**: `200 OK`
  ```json
  { "id": 1, "privacy_policy": "...", "terms_and_condition": "...", "refund_policy": "..." }
  ```

### List FAQs
- **Method**: `GET`
- **URL**: `/content/faqs`
- **Required Headers**: None
- **Success Response**: `200 OK`
  ```json
  [ { "id": 1, "question": "How does it work?", "answer": "...", "created_at": "...", "updated_at": "..." } ]
  ```

---

## Admin

### List Users (Admin Only)
- **Method**: `GET`
- **URL**: `/admin/users`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Query Parameters**: `limit=50`, `offset=0`, `search=john`
- **Success Response**: `200 OK`
  ```json
  [ { "id": "...", "email": "...", "first_name": "...", "last_name": "...", "role": "user", "verified_at": "...", ... } ]
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token
  - `403 Forbidden`: Not an admin

### Get User (Admin Only)
- **Method**: `GET`
- **URL**: `/admin/users/:id`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  { "id": "...", ... }
  ```
- **Error States**:
  - `401 Unauthorized`: No valid token
  - `403 Forbidden`: Not an admin
  - `404 Not Found`: User not found

### Update User (Admin Only)
- **Method**: `PATCH`
- **URL**: `/admin/users/:id`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "role": "admin" }
  ```
- **Success Response**: `200 OK`
  ```json
  { "id": "...", "role": "admin", ... }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid data
  - `401 Unauthorized`: No valid token
  - `403 Forbidden`: Not an admin
  - `404 Not Found`: User not found

### Get Site Contents (Admin Only)
- **Method**: `GET`
- **URL**: `/admin/content/site-contents`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  { "id": 1, "privacy_policy": "...", "terms_and_condition": "...", "refund_policy": "..." }
  ```

### Update Site Contents (Admin Only)
- **Method**: `PATCH`
- **URL**: `/admin/content/site-contents`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "privacy_policy": "Updated policy..." }
  ```
- **Success Response**: `200 OK`
  ```json
  { "id": 1, ... }
  ```

### List FAQs (Admin Only)
- **Method**: `GET`
- **URL**: `/admin/content/faqs`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  [ { "id": 1, "question": "...", "answer": "...", "deleted_at": null, ... } ]
  ```

### Create FAQ (Admin Only)
- **Method**: `POST`
- **URL**: `/admin/content/faqs`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "question": "New question?", "answer": "New answer!" }
  ```
- **Success Response**: `201 Created`
  ```json
  { "id": 2, "question": "New question?", "answer": "New answer!", ... }
  ```

### Update FAQ (Admin Only)
- **Method**: `PATCH`
- **URL**: `/admin/content/faqs/:id`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "question": "Updated question?", "answer": "Updated answer!" }
  ```
- **Success Response**: `200 OK`
  ```json
  { "id": 1, ... }
  ```
- **Error States**:
  - `404 Not Found`: FAQ not found

### Delete FAQ (Admin Only)
- **Method**: `DELETE`
- **URL**: `/admin/content/faqs/:id`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  { "ok": true }
  ```
- **Error States**:
  - `404 Not Found`: FAQ not found

### List Newsletters (Admin Only)
- **Method**: `GET`
- **URL**: `/admin/notifications/newsletters`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  [ { "id": 1, "title": "June 2026 Update", "is_admin_only": false, "created_at": "..." } ]
  ```

### Create and Send Newsletter (Admin Only)
- **Method**: `POST`
- **URL**: `/admin/notifications/newsletters`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "title": "June 2026 Update", "body_html": "<p>Hi {{firstName}}!</p>", "is_admin_only": false, "exclude_user_ids": ["user-id-to-exclude"] }
  ```
- **Success Response**: `202 Accepted`
  ```json
  { "id": 2, "recipients": 1000, "accepted": true }
  ```
  Note: Email sending happens in the background; first recipient is sent synchronously for verification.

### Preview Newsletter (Admin Only)
- **Method**: `POST`
- **URL**: `/admin/notifications/newsletters/preview`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "body_html": "<p>Hi {{firstName}}!</p>", "user_id": "user-id-to-preview-for" }
  ```
- **Success Response**: `200 OK`
  ```json
  { "html": "<p>Hi John!</p>" }
  ```

### Get Newsletter (Admin Only)
- **Method**: `GET`
- **URL**: `/admin/notifications/newsletters/:id`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  { "id": 1, "title": "June 2026 Update", "body_html": "...", "is_admin_only": false, ... }
  ```
- **Error States**:
  - `404 Not Found`: Newsletter not found

### List Affiliates (Admin Only)
- **Method**: `GET`
- **URL**: `/admin/affiliates`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  [ { "id": 1, "name": "Affiliate Name", "code": "ABCD123", "benefit": "percent_discount", "benefit_value": 50, "cap": 100, "active": true, "starts_at": null, "ends_at": null, "rewards_awarded": 0, "owner_user_id": "...", ... } ]
  ```

### Create Affiliate (Admin Only)
- **Method**: `POST`
- **URL**: `/admin/affiliates`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "name": "New Affiliate", "code": "NEWCODE123", "benefit": "percent_discount", "benefit_value": 30, "cap": 50, "active": true, "owner_user_id": "user-id" }
  ```
- **Success Response**: `201 Created`
  ```json
  { "id": 2, "name": "New Affiliate", "code": "NEWCODE123", ... }
  ```

### Update Affiliate (Admin Only)
- **Method**: `PATCH`
- **URL**: `/admin/affiliates/:id`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  { "benefit_value": 40, "active": false }
  ```
- **Success Response**: `200 OK`
  ```json
  { "id": 1, ... }
  ```
- **Error States**:
  - `404 Not Found`: Affiliate not found

### Delete Affiliate (Admin Only)
- **Method**: `DELETE`
- **URL**: `/admin/affiliates/:id`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  { "ok": true }
  ```
- **Error States**:
  - `404 Not Found`: Affiliate not found

### List Affiliate Requests (Admin Only)
- **Method**: `GET`
- **URL**: `/admin/affiliate-requests`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  [ { "id": "...", "user_id": "...", "email": "...", "pitch": "...", "social_links": [...], "status": "pending", "created_at": "...", "updated_at": "..." } ]
  ```

### Approve Affiliate Request (Admin Only)
- **Method**: `POST`
- **URL**: `/admin/affiliate-requests/:id/approve`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  { "affiliate": { "id": "...", "name": "...", "code": "GENERATED123", ... }, "code": "GENERATED123" }
  ```
- **Error States**:
  - `404 Not Found`: Request not found
  - `409 Conflict`: Request already approved

### Reject Affiliate Request (Admin Only)
- **Method**: `POST`
- **URL**: `/admin/affiliate-requests/:id/reject`
- **Required Headers**: `Authorization: Bearer <admin_access_token>`
- **Success Response**: `200 OK`
  ```json
  { "ok": true }
  ```
- **Error States**:
  - `404 Not Found`: Request not found
