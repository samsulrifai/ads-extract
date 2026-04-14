-- Fix missing RLS policies for authenticated users on shops and ads_performance

-- Allow authenticated users to view shops
CREATE POLICY "authenticated_read_shops" ON public.shops
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update shops
CREATE POLICY "authenticated_insert_shops" ON public.shops
  FOR INSERT TO authenticated WITH CHECK (true);
  
CREATE POLICY "authenticated_update_shops" ON public.shops
  FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to view ads performance
CREATE POLICY "authenticated_read_ads" ON public.ads_performance
  FOR SELECT TO authenticated USING (true);
