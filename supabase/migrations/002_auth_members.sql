-- Tabel untuk role ('admin' atau 'member')
CREATE TYPE user_role AS ENUM ('admin', 'member');

-- Tabel members untuk menyimpan profil tambahan
CREATE TABLE public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'member',
    assigned_shop_ids BIGINT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Member bisa melihat data dirinya sendiri
CREATE POLICY "Users can view own member profile" ON public.members
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Admin bisa melihat semua member
CREATE POLICY "Admins can view all members" ON public.members
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.members WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admin bisa insert member (digunakan oleh edge function)
CREATE POLICY "Admins can insert members" ON public.members
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.members WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admin bisa update member
CREATE POLICY "Admins can update members" ON public.members
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.members WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admin bisa delete member
CREATE POLICY "Admins can delete members" ON public.members
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.members WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- service_role bisa melakukan apa saja
CREATE POLICY "Service role has full access to members" ON public.members
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger untuk membuat member profile otomatis saat user register (berguna untuk auth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    is_first_user boolean;
BEGIN
    -- Check if this is the first user
    SELECT count(*) = 0 INTO is_first_user FROM public.members;
    
    INSERT INTO public.members (user_id, email, role)
    VALUES (
        new.id,
        new.email,
        CASE WHEN is_first_user THEN 'admin'::user_role ELSE 'member'::user_role END
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger update_updated_at_column
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
