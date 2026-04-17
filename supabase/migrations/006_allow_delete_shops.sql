-- Allow authenticated users to delete shops (needed for "Disconnect" button)
CREATE POLICY "authenticated_delete_shops" ON public.shops
  FOR DELETE TO authenticated USING (true);

-- Allow anon to delete shops (needed for SQL editor / dashboard usage)
CREATE POLICY "anon_delete_shops" ON public.shops
  FOR DELETE TO anon USING (true);

-- Allow authenticated users to delete ads_performance data
CREATE POLICY "authenticated_delete_ads" ON public.ads_performance
  FOR DELETE TO authenticated USING (true);

-- Allow anon to delete ads_performance data  
CREATE POLICY "anon_delete_ads" ON public.ads_performance
  FOR DELETE TO anon USING (true);
