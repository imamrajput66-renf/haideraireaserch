DROP POLICY IF EXISTS "public read settings" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_quiz_score()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('app.quiz_scoring', true) IS DISTINCT FROM 'on' AND auth.role() <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.score := NULL;
    ELSIF NEW.score IS DISTINCT FROM OLD.score OR NEW.questions IS DISTINCT FROM OLD.questions OR NEW.total IS DISTINCT FROM OLD.total THEN
      RAISE EXCEPTION 'Quiz scores can only be set by submitting answers';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_quiz_score ON public.quizzes;
CREATE TRIGGER guard_quiz_score BEFORE INSERT OR UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.guard_quiz_score();

CREATE OR REPLACE FUNCTION public.submit_quiz(_quiz_id uuid, _answers int[])
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE q jsonb; s int := 0; i int := 0;
BEGIN
  SELECT questions INTO q FROM public.quizzes WHERE id = _quiz_id AND user_id = auth.uid();
  IF q IS NULL THEN RAISE EXCEPTION 'Quiz not found'; END IF;
  FOR i IN 0 .. jsonb_array_length(q) - 1 LOOP
    IF i < coalesce(array_length(_answers, 1), 0) AND (q->i->>'answer')::int = _answers[i + 1] THEN s := s + 1; END IF;
  END LOOP;
  PERFORM set_config('app.quiz_scoring', 'on', true);
  UPDATE public.quizzes SET score = s WHERE id = _quiz_id AND user_id = auth.uid();
  PERFORM set_config('app.quiz_scoring', 'off', true);
  RETURN s;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_quiz(uuid, int[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_quiz(uuid, int[]) TO authenticated;