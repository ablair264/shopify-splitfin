-- Create a function to fetch order details with proper shipments handling
-- This avoids the ambiguous relationship issue by explicitly joining the tables

CREATE OR REPLACE FUNCTION get_order_details(order_id_param UUID, company_id_param UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', o.id,
        'legacy_order_number', o.legacy_order_number,
        'order_date', o.order_date,
        'order_status', o.order_status,
        'total', o.total,
        'sub_total', o.sub_total,
        'customer_id', o.customer_id,
        'sales_id', o.sales_id,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'customers', (
            SELECT json_build_object(
                'id', c.id,
                'display_name', c.display_name,
                'trading_name', c.trading_name,
                'email', c.email,
                'phone', c.phone,
                'billing_address_1', c.billing_address_1,
                'billing_address_2', c.billing_address_2,
                'billing_city_town', c.billing_city_town,
                'billing_county', c.billing_county,
                'billing_postcode', c.billing_postcode,
                'shipping_address_1', c.shipping_address_1,
                'shipping_address_2', c.shipping_address_2,
                'shipping_city_town', c.shipping_city_town,
                'shipping_county', c.shipping_county,
                'shipping_postcode', c.shipping_postcode
            )
            FROM customers c
            WHERE c.id = o.customer_id
        ),
        'order_line_items', (
            SELECT json_agg(
                json_build_object(
                    'id', oli.id,
                    'item_id', oli.item_id,
                    'item_name', oli.item_name,
                    'quantity', oli.quantity,
                    'unit_price', oli.unit_price,
                    'total_price', oli.total_price,
                    'quantity_shipped', oli.quantity_shipped,
                    'quantity_packed', oli.quantity_packed,
                    'quantity_delivered', oli.quantity_delivered,
                    'quantity_cancelled', oli.quantity_cancelled
                )
            )
            FROM order_line_items oli
            WHERE oli.order_id = o.id
        ),
        'shipments', (
            SELECT json_agg(
                json_build_object(
                    'id', s.id,
                    'shipment_status', s.shipment_status,
                    'order_tracking_number', s.order_tracking_number,
                    'date_shipped', s.date_shipped,
                    'date_delivered', s.date_delivered,
                    'courier_id', s.courier_id,
                    'items_shipped', s.items_shipped,
                    'items_packed', s.items_packed
                )
            )
            FROM shipments s
            WHERE s.order_id = o.id
        ),
        'invoices', (
            SELECT json_agg(
                json_build_object(
                    'id', i.id,
                    'invoice_status', i.invoice_status,
                    'invoice_date', i.invoice_date,
                    'total', i.total,
                    'balance', i.balance,
                    'payment_terms', i.payment_terms
                )
            )
            FROM invoices i
            WHERE i.order_id = o.id
        )
    ) INTO result
    FROM orders o
    WHERE o.id = order_id_param
    AND o.company_id = company_id_param;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;