-- Disponibilidade voluntária de entregadores parceiros.
ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS available_for_jobs boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS delivery_drivers_available_for_jobs_idx
  ON public.delivery_drivers (available_for_jobs)
  WHERE available_for_jobs = true;

-- Conclui uma entrega apenas se o entregador atribuído confirmou o PIN de retirada.
-- Atualização do pedido, crédito da carteira e lançamento financeiro são atômicos.
CREATE OR REPLACE FUNCTION public.complete_delivery_order(
  p_order_id uuid,
  p_driver_id uuid,
  p_earnings numeric DEFAULT 3.00
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders_log%ROWTYPE;
  v_balance numeric;
  v_earnings numeric := GREATEST(COALESCE(p_earnings, 3.00), 0);
BEGIN
  SELECT * INTO v_order
  FROM public.orders_log
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  END IF;

  IF v_order.assigned_driver_id IS DISTINCT FROM p_driver_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este pedido não está atribuído a este entregador.');
  END IF;

  IF v_order.status = 'entregue' OR v_order.delivery_status = 'entregue' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este pedido já foi concluído.');
  END IF;

  IF v_order.pickup_verified_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Confirme a retirada na loja usando o PIN antes de concluir.');
  END IF;

  UPDATE public.orders_log
  SET status = 'entregue', delivery_status = 'entregue', delivery_earnings = v_earnings
  WHERE id = p_order_id;

  UPDATE public.delivery_drivers
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_earnings,
      driver_earnings = COALESCE(driver_earnings, 0) + v_earnings
  WHERE id = p_driver_id
  RETURNING wallet_balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entregador não encontrado';
  END IF;

  INSERT INTO public.driver_wallet_transactions
    (driver_id, type, amount, balance_after, description, order_id)
  VALUES
    (p_driver_id, 'earning', v_earnings, v_balance,
     'Entrega do pedido de ' || COALESCE(v_order.customer_name, 'cliente'), p_order_id);

  IF v_order.customer_user_id IS NOT NULL THEN
    INSERT INTO public.app_notifications (target, user_id, kind, payload)
    VALUES ('customer', v_order.customer_user_id, 'status_update',
      jsonb_build_object('order_id', p_order_id, 'delivery_status', 'entregue'));
  END IF;

  RETURN jsonb_build_object('success', true, 'balance', v_balance, 'earnings', v_earnings);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_delivery_order(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_delivery_order(uuid, uuid, numeric) TO anon, authenticated;
