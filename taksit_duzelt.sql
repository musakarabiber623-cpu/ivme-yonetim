-- Mevcut taksit tutarlarındaki ondalıkları düzeltir.
-- Toplam ücret korunur; son taksit artığı alır.
-- Supabase SQL Editor'da çalıştırın.

DO $$
DECLARE
  plan_row RECORD;
  cnt      INTEGER;
  base_t   NUMERIC;
  son_t    NUMERIC;
BEGIN
  FOR plan_row IN
    SELECT id, toplam_ucret FROM odeme_planlari
  LOOP
    SELECT COUNT(*) INTO cnt
    FROM taksitler
    WHERE odeme_plan_id = plan_row.id;

    IF cnt > 0 THEN
      base_t := FLOOR(plan_row.toplam_ucret / cnt);
      son_t  := plan_row.toplam_ucret - base_t * (cnt - 1);

      -- İlk (cnt-1) taksit → base_t
      UPDATE taksitler
      SET tutar = base_t
      WHERE odeme_plan_id = plan_row.id
        AND taksit_no < cnt;

      -- Son taksit → son_t (artığı alır)
      UPDATE taksitler
      SET tutar = son_t
      WHERE odeme_plan_id = plan_row.id
        AND taksit_no = cnt;
    END IF;
  END LOOP;

  RAISE NOTICE 'Tüm taksit tutarları tam sayıya yuvarlandı.';
END $$;
