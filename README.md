# Name Profile API

A REST API that classifies names by gender, age, and nationality.

## Base URL
https://name-profile-api.vercel.app

## Endpoints

### Create Profile
POST /api/profiles
Body: { "name": "james" }

### Get All Profiles
GET /api/profiles

### Get Single Profile
GET /api/profiles/:id

### Delete Profile
DELETE /api/profiles/:id

