# Static Frontend Hosting

The main portal and super-admin dashboard are static build artifacts and should be deployed independently from the API.

## Main Portal

Build variable:

- `REACT_APP_BACKEND_URL=https://api.example.com`

Build command:

```bash
npm run build
```

Artifact:

- `frontend/build`

## Super Admin

Build variable:

- `VITE_API_BASE_URL=https://api.example.com/api/platform`

Build command:

```bash
npm run build
```

Artifact:

- `super-admin-dashboard/dist`

## CDN Rules

- Cache hashed JS/CSS/image assets for 30 days or longer.
- Do not aggressively cache `index.html`.
- Enable HTTPS only.
- Enable compression.
- Configure SPA fallback to `index.html`.
