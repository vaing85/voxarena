"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseAdmin = getSupabaseAdmin;
const supabase_js_1 = require("@supabase/supabase-js");
let admin = null;
/**
 * Server-only Supabase client (service role). Use for admin tasks; never expose to the client.
 * Returns null if SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are unset.
 */
function getSupabaseAdmin() {
    if (admin)
        return admin;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        return null;
    admin = (0, supabase_js_1.createClient)(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return admin;
}
