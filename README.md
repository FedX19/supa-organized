# SupaOrganized

A SaaS web application that helps sports organizations search and manage their Supabase users. Connect your Supabase database and instantly search, view, and manage all your users, organizations, teams, and players in one beautiful dashboard.

## Features

- **Instant Search**: Search through all your users by name, email, or organization
- **See Relationships**: Understand your data at a glance - see which organizations users belong to, their roles, and their connected players
- **Secure & Private**: Your Supabase credentials are encrypted with AES-256 encryption. Your data stays in your database

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Dark theme matching UniteHQ design)
- **Database & Auth**: Supabase
- **Encryption**: crypto-js (AES-256)

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project for SupaOrganized itself

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/supa-organized.git
   cd supa-organized
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment example and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

4. Set up your Supabase database with the required table:
   ```sql
   CREATE TABLE user_connections (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     supabase_url TEXT NOT NULL,
     encrypted_key TEXT NOT NULL,
     connection_name TEXT NOT NULL DEFAULT 'My Supabase',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(user_id)
   );

   CREATE INDEX idx_user_connections_user_id ON user_connections(user_id);
   ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

   -- RLS policies
   CREATE POLICY "Users can view own connections" ON user_connections FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own connections" ON user_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own connections" ON user_connections FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete own connections" ON user_connections FOR DELETE USING (auth.uid() = user_id);
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (server-side only) |
| `ENCRYPTION_KEY` | A secret key for encrypting customer credentials (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g., http://localhost:3000) |

## Customer Database Schema

SupaOrganized expects the connected customer's Supabase to have the following tables:

- `profiles` - User profiles (id, full_name, email)
- `organizations` - Organizations (id, name)
- `organization_staff` - Staff members with roles (profile_id, organization_id, role)
- `organization_members` - Regular members (profile_id, organization_id)
- `players` - Youth athletes (player_name, organization_id, guardian_profile_id)
- `teams` - Teams (name, organization_id)

## Security

- Customer Supabase service role keys are encrypted with AES-256 before storage
- Row Level Security (RLS) ensures users can only access their own connections
- Service role keys are only used server-side

## License

MIT
