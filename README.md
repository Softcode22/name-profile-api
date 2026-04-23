# Name Profile API — Stage 2

A REST API that stores demographic profiles and supports advanced filtering, 
sorting, pagination, and natural language search.

## Base URL
https://name-profile-api-v2.vercel.app

---

## Endpoints

### 1. Create Profile
**POST** `/api/profiles`

Request body:
{ "name": "amara" }

Success (201):
{
  "status": "success",
  "data": {
    "id": "uuid-here",
    "name": "amara",
    "gender": "female",
    "gender_probability": 0.97,
    "age": 28,
    "age_group": "adult",
    "country_id": "NG",
    "country_name": "Nigeria",
    "country_probability": 0.85,
    "created_at": "2026-04-23T12:00:00Z"
  }
}

If name already exists returns existing profile with message "Profile already exists".

---

### 2. Get All Profiles
**GET** `/api/profiles`

Supports filtering, sorting, and pagination combined.

**Filters:**
- gender → male | female
- age_group → child | teenager | adult | senior
- country_id → ISO code e.g. NG, KE, GH
- min_age → minimum age (inclusive)
- max_age → maximum age (inclusive)
- min_gender_probability → e.g. 0.8
- min_country_probability → e.g. 0.5

**Sorting:**
- sort_by → age | created_at | gender_probability
- order → asc | desc

**Pagination:**
- page → default 1
- limit → default 10, max 50

Example:
/api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10

Success (200):
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2034,
  "data": [...]
}

---

### 3. Natural Language Search
**GET** `/api/profiles/search?q=your query here`

Converts plain English into database filters.

Example:
/api/profiles/search?q=young males from nigeria

---

### 4. Get Single Profile
**GET** `/api/profiles/:id`

### 5. Delete Profile
**DELETE** `/api/profiles/:id`

---

## Natural Language Parsing Approach

The parser reads the query string word by word and matches keywords 
to known filter patterns. No AI or LLM is used it is purely 
rule-based pattern matching.

### How it works

1. The query is lowercased
2. It is scanned for gender keywords
3. It is scanned for age keywords and numeric patterns
4. It is scanned for country name keywords
5. All matched filters are combined into a MongoDB query
6. If no keywords are recognised, an error is returned

---

### Query Examples

| Query | Resulting Filters |
|---|---|
| young males | gender=male, age 16-24 |
| females above 30 | gender=female, min_age=30 |
| people from angola | country_id=AO |
| adult males from kenya | gender=male, age_group=adult, country_id=KE |
| senior females below 80 | gender=female, age_group=senior, max_age=80 |
| teenagers from ghana | age_group=teenager, country_id=GH |

---

## Tech Stack
- Node.js + Express
- MongoDB Atlas + Mongoose
- Deployed on Vercelq
