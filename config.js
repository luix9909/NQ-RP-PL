
window.SUPABASE_URL = "https://oskelvbndtqvaxxfujhs.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za2VsdmJuZHRxdmF4eGZ1amhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMjA5MDYsImV4cCI6MjA5OTc5NjkwNn0.qI_Khh_p1gNFHuwTZPuedqC6WmiWf2IzHWqchGL1yf4"; 

// التحقق ما إذا كانت معرّفة مسبقاً لمنع الخطأ تماماً
if (!window.supabase) {
    window.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}
