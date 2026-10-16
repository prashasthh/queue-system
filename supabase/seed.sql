INSERT INTO restaurants(id,name,slug,whatsapp_number,address) VALUES
 ('00000000-0000-4000-8000-000000000001','Demo Restaurant','demo-restaurant','+919876543210','12, Garden Road · Bengaluru') ON CONFLICT DO NOTHING;
INSERT INTO restaurant_settings(restaurant_id) VALUES
 ('00000000-0000-4000-8000-000000000001')
ON CONFLICT(restaurant_id) DO NOTHING;
INSERT INTO restaurant_tables(restaurant_id,table_number,name,capacity) VALUES
 ('00000000-0000-4000-8000-000000000001','T1','Window two',2),
 ('00000000-0000-4000-8000-000000000001','T2','Garden four',4),
 ('00000000-0000-4000-8000-000000000001','T3','Family six',6),
 ('00000000-0000-4000-8000-000000000001','T4','Main four',4),
 ('00000000-0000-4000-8000-000000000001','T5','Large party',8),
 ('00000000-0000-4000-8000-000000000001','T6','Corner two',2)
ON CONFLICT(restaurant_id,table_number) DO NOTHING;
INSERT INTO menu_categories(id,restaurant_id,name,sort_order) VALUES
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','Starters',1),
 ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001','Main Course',2),
 ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001','Beverages',3),
 ('00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000001','Desserts',4) ON CONFLICT DO NOTHING;
INSERT INTO menu_items(restaurant_id,category_id,name,description,price,vegetarian)
SELECT '00000000-0000-4000-8000-000000000001'::uuid, c.id, v.name, v.description, v.price, v.veg
FROM (VALUES
 ('Starters','Veg Manchurian','Crisp vegetable bites, tossed in a tangy garlic sauce.',18000,true),
 ('Starters','Chicken 65','South Indian spiced chicken with curry leaves.',24000,false),
 ('Starters','French Fries','Golden, crisp and finished with sea salt.',12000,true),
 ('Main Course','Veg Biryani','Fragrant basmati rice, garden vegetables and warm spices.',22000,true),
 ('Main Course','Chicken Biryani','Slow-cooked chicken layered with aromatic basmati.',28000,false),
 ('Main Course','Paneer Butter Masala','Soft paneer in a rich tomato and butter gravy.',26000,true),
 ('Main Course','Butter Naan','Tandoor-baked flatbread brushed with butter.',6000,true),
 ('Beverages','Coke','A chilled classic. 300 ml.',5000,true),
 ('Beverages','Sprite','Lemon-lime refreshment. 300 ml.',5000,true),
 ('Beverages','Water','Packaged drinking water. 500 ml.',2000,true),
 ('Desserts','Gulab Jamun','Two warm dumplings in cardamom-scented syrup.',10000,true),
 ('Desserts','Ice Cream','Two scoops of creamy vanilla.',12000,true)
) AS v(category,name,description,price,veg)
JOIN menu_categories c ON c.name=v.category AND c.restaurant_id='00000000-0000-4000-8000-000000000001'
ON CONFLICT DO NOTHING;
UPDATE menu_items SET image_url=CASE name
 WHEN 'Veg Manchurian' THEN '/menu/veg-manchurian.png'
 WHEN 'Chicken 65' THEN '/menu/chicken-65.png'
 WHEN 'French Fries' THEN '/menu/french-fries.png'
 WHEN 'Veg Biryani' THEN '/menu/veg-biryani.png'
 WHEN 'Chicken Biryani' THEN '/menu/chicken-biryani.png'
 WHEN 'Paneer Butter Masala' THEN '/menu/paneer-butter-masala.png'
 WHEN 'Butter Naan' THEN '/menu/butter-naan.png'
 WHEN 'Coke' THEN '/menu/coke.png'
 WHEN 'Sprite' THEN '/menu/sprite.png'
 WHEN 'Water' THEN '/menu/water.png'
 WHEN 'Gulab Jamun' THEN '/menu/gulab-jamun.png'
 WHEN 'Ice Cream' THEN '/menu/ice-cream.png'
 WHEN 'Biryani Combo' THEN '/menu/chicken-biryani.png'
 ELSE image_url END
WHERE restaurant_id='00000000-0000-4000-8000-000000000001';
INSERT INTO menu_items(id,restaurant_id,category_id,name,description,price,vegetarian,item_type)
SELECT '00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000001',id,'Biryani Combo','Chicken Biryani, Coke and Gulab Jamun.',37900,false,'combo'
FROM menu_categories WHERE restaurant_id='00000000-0000-4000-8000-000000000001' AND name='Main Course'
ON CONFLICT DO NOTHING;
INSERT INTO menu_combo_items(combo_item_id,component_item_id,quantity)
SELECT '00000000-0000-4000-8000-000000000021',id,1 FROM menu_items
WHERE restaurant_id='00000000-0000-4000-8000-000000000001' AND name IN ('Chicken Biryani','Coke','Gulab Jamun')
ON CONFLICT DO NOTHING;
UPDATE menu_items SET image_url='/menu/chicken-biryani.png'
WHERE id='00000000-0000-4000-8000-000000000021';
