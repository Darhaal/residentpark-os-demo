// Title: Setup Env DB Test Helper
// Path: src/test/db/setup-env.ts
// Functionality: Shared database test harness support for Supabase authorization checks.

// Runs in each test worker before the DB test files import — populates process.env.
import { loadEnvFile } from './env';

loadEnvFile();
