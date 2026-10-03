<script>
/* =================================================================
   БАЗА ДОКАЗАТЕЛЬСТВ (signal + noise)
   Шумовые улики (noise_*) кликабельны, но НЕ ведут к раскрытию.
   Они учат различать сигнал и шум и наказывают за преждевременные
   выводы в финальной оценке.
   ================================================================= */
const EV_LIBRARY = {
  /* --- из открытых документов: базовые факты и основания --- */
  payment_terms_2_days:{title:'Срок оплаты перевозчику — 2 дня вместо 30',source:'Договор ТС-2024-001',reliability:'high',weight:8,tags:['contract','base']},
  sod_violation_procurement:{title:'Директор по закупкам инициировал договор и утверждал оплату',source:'Договор ТС-2024-001',reliability:'high',weight:10,tags:['control','sod']},
  invoice_feb_18m:{title:'Февральский счёт на логистику — 18 400 000 ₽',source:'Счёт 1042',reliability:'high',weight:6,tags:['invoice','base']},
  invoice_tracking_id:{title:'В счёте указан tracking ID GC-77X9',source:'Счёт 1042',reliability:'medium',weight:5,tags:['invoice','base']},
  invoice_container_reuse:{title:'Контейнер MSKU7736210 повторяется в нескольких счетах',source:'Счёт 1042 / реестр',reliability:'high',weight:12,tags:['invoice','pattern']},
  bol_issue_date:{title:'Коносамент выпущен 03.02.2024',source:'Bill of Lading HKG-77X9',reliability:'high',weight:4,tags:['logistics','base']},
  bol_container_msku:{title:'Коносамент ссылается на контейнер MSKU7736210',source:'Bill of Lading HKG-77X9',reliability:'medium',weight:5,tags:['logistics','base']},
  vendor_new:{title:'Перевозчик зарегистрирован 18.07.2023, незадолго до контракта',source:'Выписка ЕГРЮЛ',reliability:'medium',weight:7,tags:['vendor','base']},
  vendor_mass_address:{title:'Адрес перевозчика — массовый офисный (Складочная, 1, оф.405)',source:'Выписка ЕГРЮЛ',reliability:'medium',weight:6,tags:['vendor','base']},
  payments_rapid:{title:'Платежи перевозчику проходили за 1–2 дня',source:'Реестр платежей',reliability:'high',weight:8,tags:['payment','base']},
  payment_before_grn:{title:'Оплаты проводились без складской приемки (GRN)',source:'Реестр платежей / three-way',reliability:'high',weight:10,tags:['payment','control']},
  email_expedite:{title:'Волков требовал провести платёж до внутренней проверки',source:'Письмо 11.02.2024',reliability:'high',weight:10,tags:['email','intent']},
  email_override_tracking:{title:'Оплата обосновывалась «подтверждённым треком» без независимой проверки',source:'Письмо 11.02.2024',reliability:'medium',weight:8,tags:['email','override']},
  policy_payment_terms_30:{title:'Политика компании: оплата 30 дней после подтверждённой приемки',source:'Политика закупок v4.2',reliability:'medium',weight:4,tags:['policy','base']},
  three_way_mismatch:{title:'Three-way matching нарушен: счёт есть, приемки нет',source:'Отчет matching, февраль',reliability:'high',weight:12,tags:['control','matching']},

  /* --- шумовые улики (кликнуть можно, пользы нет) --- */
  noise_price_above_market:{title:'Ставка перевозчика на 12% выше средней по рынку',source:'Договор / бенчмарк',reliability:'low',weight:0,tags:['noise'],noise:true},
  noise_address_office:{title:'Перевозчик арендует офис в бизнес-центре',source:'Выписка ЕГРЮЛ',reliability:'low',weight:0,tags:['noise'],noise:true},
  noise_email_tone:{title:'Тон письма Волкова резкий и требовательный',source:'Письмо 11.02.2024',reliability:'low',weight:0,tags:['noise'],noise:true},
  noise_new_vendor_growth:{title:'Новый перевозчик быстро набрал долю рынка',source:'Аналитика закупок',reliability:'low',weight:0,tags:['noise'],noise:true},
  noise_seasonal_surge:{title:'В феврале традиционно рост импортных поставок',source:'Справка планового отдела',reliability:'low',weight:0,tags:['noise'],noise:true},

  /* --- скрытые улики: только через запросы --- */
  vessel_schedule_mismatch:{title:'Судно вышло из порта 05.02, а коносамент датирован 03.02',source:'Запрос: расписание судна',reliability:'high',weight:14,tags:['logistics','core']},
  dispatch_log_no_booking:{title:'В диспетчерском журнале нет брони на контейнер MSKU7736210',source:'Запрос: dispatch log',reliability:'high',weight:14,tags:['logistics','core']},
  bank_counterparty_new_account:{title:'Счёт перевозчика открыт за 6 дней до первого платежа',source:'Запрос: bank trail',reliability:'high',weight:12,tags:['bank','pattern']},
  bank_payment_trail_round_trip:{title:'Часть средств счёта перевозчика уходит на связанные юрлица',source:'Запрос: bank trail',reliability:'high',weight:14,tags:['bank','core']},
  customs_risk_flag:{title:'Декларация помечена риском, выпуск проведён вручную',source:'Запрос: customs risk',reliability:'high',weight:12,tags:['customs','override']},
  customs_no_inspection_record:{title:'Нет записи о досмотре при заявленном весе 18,4 т',source:'Запрос: customs risk',reliability:'high',weight:12,tags:['customs','core']},
  it_whois_recent:{title:'Домен ts-tracking.online зарегистрирован 28.01.2024',source:'Запрос: IT forensics',reliability:'high',weight:12,tags:['tracking','domain']},
  it_ip_overlap:{title:'IP/DNS трекинг-сервиса пересекаются с инфраструктурой перевозчика',source:'Запрос: IT forensics',reliability:'high',weight:14,tags:['tracking','infra']},
  it_site_template:{title:'Сайт трекинга — шаблон без интеграций с портами и линиями',source:'Запрос: IT forensics',reliability:'high',weight:14,tags:['tracking','fraud']},
  compliance_vendor_shell:{title:'У перевозчика нет транспорта, лицензий и портовых соглашений',source:'Запрос: compliance DD',reliability:'high',weight:12,tags:['vendor','shell']},
  compliance_beneficial_relative:{title:'Бенефициар перевозчика — брат супруги Волкова А.П.',source:'Запрос: compliance DD',reliability:'high',weight:16,tags:['vendor','related']},
  compliance_onboarding_skipped:{title:'Онбординг поставщика проведён задним числом',source:'Запрос: compliance DD',reliability:'high',weight:12,tags:['control','override']},
  warehouse_grn_absent:{title:'GRN не создан ни по одному счёту перевозчика',source:'Запрос: warehouse audit',reliability:'high',weight:14,tags:['warehouse','core']},
  warehouse_courier_pattern:{title:'Один курьер подписывает акты без фактической передачи груза',source:'Запрос: warehouse audit',reliability:'medium',weight:10,tags:['warehouse','pattern']},

  /* --- интервью (значения используются в части 3) --- */
  volkov_claim_urgent:{title:'Волков: перевозки были срочными из-за остановки линии',source:'Интервью: Волков А.П.',reliability:'low',weight:3,tags:['statement','defense']},
  volkov_claim_tracking_confirmed:{title:'Волков: решение основывалось на «подтверждённом треке»',source:'Интервью: Волков А.П.',reliability:'low',weight:3,tags:['statement','tracking']},
  volkov_pressured_accountant:{title:'Волков признал, что давил на бухгалтерию ради скорости',source:'Интервью: Волков А.П.',reliability:'medium',weight:8,tags:['statement','pressure']},
  volkov_admits_relative:{title:'Волков признал родство с бенефициаром перевозчика',source:'Интервью: Волков А.П.',reliability:'medium',weight:10,tags:['statement','related']},
  volkov_contradicts_warehouse:{title:'Волков не объяснил «доставку» при отсутствии приемки',source:'Интервью: Волков + склад',reliability:'high',weight:12,tags:['contradiction','core']},
  volkov_no_independent_verification:{title:'Волков не проверял трекинг независимо от перевозчика',source:'Интервью: Волков А.П.',reliability:'medium',weight:8,tags:['control_failure']},
  warehouse_confirms_no_receipt:{title:'Склад: груз по MSKU7736210 физически не поступал',source:'Интервью: Соколова М.И.',reliability:'high',weight:12,tags:['statement','warehouse']},
  warehouse_courier_signature:{title:'Склад: акты подписывал курьер, контейнер не вскрывали',source:'Интервью: Соколова М.И.',reliability:'medium',weight:8,tags:['statement','document']},
  warehouse_no_other_shipments:{title:'Склад: реальных поставок от «Транс-Север» не видит',source:'Интервью: Соколова М.И.',reliability:'medium',weight:8,tags:['statement','pattern']},
  it_confirms_fake_tracking:{title:'IT: интерфейс трекинга заполняется вручную, API нет',source:'Интервью: Лебедева А.С.',reliability:'high',weight:10,tags:['statement','tracking']},
  it_domain_registered_after_contract:{title:'IT: домен появився после начала операций',source:'Интервью: Лебедева А.С.',reliability:'medium',weight:8,tags:['statement','domain']},
  it_ip_vendor_confirmed:{title:'IT: инфраструктура трекинга связана с перевозчиком',source:'Интервью: Лебедева А.С.',reliability:'high',weight:10,tags:['statement','infra']}
};

/* =================================================================
   КЕЙС #1: ФАНТОМНАЯ ЛОГИСТИКА (усложнённая версия)
   interviews / controls / гипотезы дописываются в части 3.
   ================================================================= */
const CASES_DB = {
  'case-1': {
    title:'КЕЙС #1: ФАНТОМНАЯ ЛОГИСТИКА',
    industry:'ЗАКУПКИ / ЛОГИСТИКА',
    difficulty:'СРЕДНИЙ+',
    timeMinutes:360,
    maxInterviews:3,
    maxRequests:6,
    context:'ПАО «ТехноСфера» фиксирует рост логистических расходов на 38% при увеличении объёма перевозок лишь на 9%. Новый перевозчик ООО «Транс-Север Логистик» за 4 месяца получил 27% отправок. На поверхности документы выглядят связно: договор, счета, коносамент, таможенная декларация, ссылка на онлайн-трекинг со статусом «доставлено». Однако склад не подтверждает приемку, GPS-данные противоречат морскому маршруту, а сам трекинг-сервис вызывает вопросы. Часть ключевых данных недоступна напрямую — её нужно запрашивать у логистики, банка, таможни, IT, комплаенса и склада. Запросы требуют основания и могут отклоняться.',
    objectives:[
      'Отделить реальные перевозки от оплаченных, но несостоявшихся',
      'Сопоставить коносамент, расписание судна, GPS и складскую приемку',
      'Проверить легитимность трекинг-сервиса перевозчика',
      'Выявить связанность перевозчика с сотрудниками (conflict of interest)',
      'Собрать доказательственную базу, достаточную для эскалации, и предложить контроли'
    ],
    resources:[
      {val:'6 часов',lbl:'Аудиторское время'},
      {val:'15',lbl:'Документов (часть скрыта)'},
      {val:'6',lbl:'Официальных запросов'},
      {val:'3',lbl:'Интервью'}
    ],
    alerts:[
      'Логистические расходы +38% YoY при объёме перевозок +9%',
      'Новый перевозчик занял 27% отправок за 4 месяца',
      'Срок оплаты 2 дня вместо политикowych 30',
      'Ряд счетов оплачен без подтверждённой складской приемки'
    ],
    metrics:[
      {title:'РОСТ РАСХОДОВ',val:'+38%',lbl:'Логистика YoY',type:'danger'},
      {title:'РОСТ ОБЪЁМА',val:'+9%',lbl:'Фактические перевозки',type:'warning'},
      {title:'НОВЫЙ ПЕРЕВОЗЧИК',val:'27%',lbl:'Доля отправок',type:'warning'},
      {title:'СРОК ОПЛАТЫ',val:'2 дня',lbl:'Вместо 30 дней',type:'danger'}
    ],

    /* ---------------- ДОКУМЕНТЫ ----------------
       locked:true + unlockedBy:<requestId> => открывается только после одобрения запроса.
       Кликабельные поля НЕ подсвечены как «полезные»: среди них есть шум (noise_*).
    */
    documents:[
      {id:'contract',locked:false,type:'ДОГОВОР',title:'Договор перевозки № ТС-2024-001',meta:'ООО «Транс-Север Логистик» • 05.08.2023 • PDF',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">ДОГОВОР ПЕРЕВОЗКИ № ТС-2024-001</h2><div class="tb-doc-page-meta">ПАО «ТехноСфера» — ООО «Транс-Север Логистик»</div><div class="tb-doc-field-row"><div class="tb-doc-label">Предмет</div><div class="tb-doc-value">Международная доставка электронных компонентов и драгметаллов, таможенное сопровождение</div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Срок оплаты</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="payment_terms_2_days">2 календарных дня</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Ставка</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="noise_price_above_market">на 12% выше бенчмарка</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Инициатор / подписант</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="sod_violation_procurement">Волков А.П., директор по закупкам</button></div></div><div class="tb-doc-note">Политика компании требует оплаты 30 дней после подтверждённой приемки (GRN). Исключения — только через финдиректора.</div></div>`},

      {id:'invoice',locked:false,type:'СЧЕТ / АКТ',title:'Счёт на оплату № 1042 от 10.02.2024',meta:'«Транс-Север Логистик» • февраль 2024 • PDF',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">СЧЕТ № 1042</h2><div class="tb-doc-page-meta">Период: февраль 2024</div><div class="tb-doc-field-row"><div class="tb-doc-label">Итого</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="invoice_feb_18m">18 400 000 ₽</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Tracking ID</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="invoice_tracking_id">GC-77X9</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Контейнер</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="invoice_container_reuse">MSKU7736210</button></div></div><table class="tb-doc-table"><thead><tr><th>Услуга</th><th>Сумма</th><th>Комментарий</th></tr></thead><tbody><tr><td>Морская перевозка</td><td>12 100 000 ₽</td><td>Шэньчжэнь — СПб</td></tr><tr><td>Таможенное сопровождение</td><td>4 300 000 ₽</td><td>ДТ 10702000/02032024/0012345</td></tr><tr><td>Складская обработка</td><td>2 000 000 ₽</td><td>Приемка не подтверждена</td></tr></tbody></table><div class="tb-doc-note">Тот же контейнер MSKU7736210 и трек GC-77X9 встречаются в счетах 1057 и 1069.</div></div>`},

      {id:'bol',locked:false,type:'ТРАНСПОРТНЫЙ ДОКУМЕНТ',title:'Bill of Lading № HKG-77X9',meta:'Ocean Star Line • контейнер MSKU7736210 • PDF',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">BILL OF LADING № HKG-77X9</h2><div class="tb-doc-page-meta">Шэньчжэнь — Санкт-Петербург</div><div class="tb-doc-field-row"><div class="tb-doc-label">Отправитель</div><div class="tb-doc-value">Metro Electronics Ltd.</div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Получатель</div><div class="tb-doc-value">ПАО «ТехноСфера»</div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Контейнер</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="bol_container_msku">MSKU7736210</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Вес брутто</div><div class="tb-doc-value">18 400 кг</div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Дата выпуска коносамента</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="bol_issue_date">03.02.2024</button></div></div><div class="tb-doc-note">Чтобы оценить корректность даты выпуска, нужно независимое расписание судна (запрос в логистику).</div></div>`},

      {id:'vendor',locked:false,type:'КОНТРАГЕНТ',title:'Выписка ЕГРЮЛ (базовая)',meta:'ООО «Транс-Север Логистик» • ИНН 7707XXXXXX',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">ПРОФИЛЬ ПЕРЕВОЗЧИКА (БАЗОВЫЙ)</h2><div class="tb-doc-page-meta">Открытые регистровые данные</div><div class="tb-doc-field-row"><div class="tb-doc-label">Дата регистрации</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="vendor_new">18.07.2023</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Адрес</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="vendor_mass_address">Складочная, 1, оф. 405</button> · <button class="tb-ev-field" data-ev="noise_address_office">бизнес-центр</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Основной вид деятельности</div><div class="tb-doc-value">Деятельность автомобильного грузового транспорта</div></div><div class="tb-doc-note">Бенефициары, лицензии, парк ТС и портовые соглашения не раскрыты в базовой выписке — требуется усиленный DD (запрос в комплаенс).</div></div>`},

      {id:'payments',locked:false,type:'КАЗНАЧЕЙСТВО',title:'Реестр платежей по логистике',meta:'Февраль — март 2024 • XLSX • фрагмент',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">РЕЕСТР ПЛАТЕЖЕЙ (ЛОГИСТИКА)</h2><div class="tb-doc-page-meta">Выдержка из казначейского отчёта</div><table class="tb-doc-table"><thead><tr><th>Дата</th><th>Получатель</th><th>Сумма</th><th>Срок с момента счёта</th><th>GRN</th></tr></thead><tbody><tr><td>12.02.2024</td><td>Транс-Север Логистик</td><td>18 400 000 ₽</td><td><button class="tb-ev-field" data-ev="payments_rapid">2 дня</button></td><td>Нет</td></tr><tr><td>19.02.2024</td><td>Транс-Север Логистик</td><td>17 900 000 ₽</td><td>1 день</td><td>Нет</td></tr><tr><td>26.02.2024</td><td>Транс-Север Логистик</td><td>18 100 000 ₽</td><td>2 дня</td><td>Нет</td></tr><tr><td>15.02.2024</td><td>Логистик Плюс</td><td>4 200 000 ₽</td><td>28 дней</td><td>Да</td></tr></tbody></table><div class="tb-doc-field-row" style="margin-top:12px"><div class="tb-doc-label">Вывод по строкам перевозчика</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="payment_before_grn">оплата без приемки</button></div></div></div>`},

      {id:'email',locked:false,type:'ПЕРЕПИСКА',title:'Письмо Волкова А.П. бухгалтеру',meta:'11.02.2024 18:37 • Email',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">ЭЛЕКТРОННОЕ ПИСЬМО</h2><div class="tb-doc-page-meta">От: volkov@technosfera.local · Кому: sokolov@technosfera.local</div><div class="tb-doc-field-row"><div class="tb-doc-label">Тема</div><div class="tb-doc-value">Срочно по Транс-Северу</div></div><div class="tb-doc-note" style="border-left-color:#FFDD2D;background:#FFFBEB">Павел,<br><br>Проведи сегодня счёт 1042. Трек уже показывает доставку, склад докумитирует потом. Важно закрыть оплату до понедельника, пока не пришла внутренняя проверка. Если будут вопросы — это согласованная срочная логистика.<br><br>Артём Волков</div><div class="tb-doc-field-row" style="margin-top:12px"><div class="tb-doc-label">Намерение</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="email_expedite">оплатить до проверки</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Основание оплаты</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="email_override_tracking">непроверенный трек</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Стиль</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="noise_email_tone">резкий тон</button></div></div></div>`},

      {id:'matching',locked:false,type:'СИСТЕМНЫЙ ОТЧЕТ',title:'Three-way matching report',meta:'ERP • февраль 2024 • фрагмент',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">THREE-WAY MATCHING</h2><div class="tb-doc-page-meta">PO-5521 · INV-1042 · GRN</div><table class="tb-doc-table"><thead><tr><th>Элемент</th><th>Статус</th><th>Комментарий</th></tr></thead><tbody><tr><td>Purchase Order</td><td>Есть</td><td>Утверждён Волковым</td></tr><tr><td>Invoice</td><td>Есть</td><td>18 400 000 ₽</td></tr><tr><td>Goods Receipt Note</td><td>Нет</td><td>Склад не подтвердил</td></tr></tbody></table><div class="tb-doc-field-row" style="margin-top:12px"><div class="tb-doc-label">Вывод системы</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="three_way_mismatch">соответствие нарушено</button></div></div></div>`},

      {id:'policy',locked:false,type:'РЕГЛАМЕНТ',title:'Политика закупок и оплаты',meta:'v4.2 • с 01.01.2023',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">ПОЛИТИКА ЗАКУПОК И ОПЛАТЫ</h2><div class="tb-doc-page-meta">ПАО «ТехноСфера» · логистика</div><div class="tb-doc-field-row"><div class="tb-doc-label">Стандартный срок оплаты</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="policy_payment_terms_30">30 календарных дней</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Условие</div><div class="tb-doc-value">Подтверждённая приемка (GRN)</div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Исключения</div><div class="tb-doc-value">Только письменное согласование финдиректора</div></div><div class="tb-doc-note">Срочность производства сама по себе не является основанием для обхода three-way matching.</div></div>`},

      {id:'analytics',locked:false,type:'АНАЛИТИКА',title:'Справка планового отдела по рынку',meta:'Февраль 2024 • PDF',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">РЫНОЧНАЯ СПРАВКА</h2><div class="tb-doc-page-meta">Плановый отдел · контекст</div><div class="tb-doc-field-row"><div class="tb-doc-label">Сезонность</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="noise_seasonal_surge">февраль — пик импорта</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Доли перевозчиков</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="noise_new_vendor_growth">новый игрок растёт быстро</button></div></div><div class="tb-doc-note">Справка описывает рынок, но не подтверждает фактическое перемещение конкретных грузов.</div></div>`},

      /* ---------- СКРЫТЫЕ ДОКУМЕНТЫ (только через запросы) ---------- */
      {id:'schedule',locked:true,unlockedBy:'logistics',type:'ЛОГИСТИКА',title:'Расписание судна (vessel schedule)',meta:'Открывается запросом в логистику',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">РАСПИСАНИЕ СУДНА</h2><div class="tb-doc-page-meta">Ocean Star Line · маршрут Шэньчжэнь — СПб</div><div class="tb-doc-field-row"><div class="tb-doc-label">Плановый выход судна</div><div class="tb-doc-value">05.02.2024</div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Дата коносамента (из BOL)</div><div class="tb-doc-value">03.02.2024</div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Сверка</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="vessel_schedule_mismatch">коносамент раньше выхода судна</button></div></div><div class="tb-doc-note">Документ, выпущенный до отплытия, не может подтверждать фактическую погрузку.</div></div>`},

      {id:'dispatch',locked:true,unlockedBy:'logistics',type:'ЛОГИСТИКА',title:'Диспетчерский журнал (dispatch log)',meta:'Открывается запросом в логистику',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">DISPATCH LOG</h2><div class="tb-doc-page-meta">Бронирования и отгрузки · февраль</div><table class="tb-doc-table"><thead><tr><th>Контейнер</th><th>Бронь</th><th>Отгрузка</th></tr></thead><tbody><tr><td>MSKU7736211</td><td>Есть</td><td>06.02</td></tr><tr><td>MSKU7736210</td><td><button class="tb-ev-field" data-ev="dispatch_log_no_booking">Нет записи</button></td><td>—</td></tr><tr><td>MSKU7736209</td><td>Есть</td><td>04.02</td></tr></tbody></table><div class="tb-doc-note">Спорный контейнер отсутствует в журнале бронирований линии.</div></div>`},

      {id:'banktrail',locked:true,unlockedBy:'bank',type:'БАНК',title:'Bank trail по счёту перевозчика',meta:'Открывается запросом в банк',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">BANK TRAIL</h2><div class="tb-doc-page-meta">Счёт ООО «Транс-Север Логистик»</div><div class="tb-doc-field-row"><div class="tb-doc-label">Дата открытия счёта</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="bank_counterparty_new_account">06.02.2024 (за 6 дней до платежа)</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Движение после зачисления</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="bank_payment_trail_round_trip">транзит на связанные юрлица</button></div></div><table class="tb-doc-table"><thead><tr><th>Дата</th><th>Операция</th><th>Контрагент</th></tr></thead><tbody><tr><td>12.02</td><td>Входящий 18,4M</td><td>ТехноСфера</td></tr><tr><td>12.02</td><td>Исходящий 17,1M</td><td>Метро Трейд (связанное)</td></tr><tr><td>13.02</td><td>Исходящий 0,9M</td><td>Налоги/прочее</td></tr></tbody></table></div>`},

      {id:'customsrisk',locked:true,unlockedBy:'customs',type:'ТАМОЖНЯ',title:'Таможенный risk-отчёт по ДТ',meta:'Открывается запросом к брокеру/таможне',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">CUSTOMS RISK REPORT</h2><div class="tb-doc-page-meta">ДТ 10702000/02032024/0012345</div><div class="tb-doc-field-row"><div class="tb-doc-label">Заявленный вес</div><div class="tb-doc-value">18 400 кг</div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Профиль риска</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="customs_risk_flag">высокий, выпуск вручную</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Досмотр</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="customs_no_inspection_record">записей нет</button></div></div><div class="tb-doc-note">Выпуск без досмотра при высоком профиле и нулевой складской приемке — аномалия.</div></div>`},

      {id:'itforensics',locked:true,unlockedBy:'it',type:'IT / DIGITAL',title:'Digital forensics по трекинг-сервису',meta:'Открывается запросом в IT',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">IT FORENSICS · ts-tracking.online</h2><div class="tb-doc-page-meta">Анализ домена и инфраструктуры</div><div class="tb-doc-field-row"><div class="tb-doc-label">Регистрация домена (WHOIS)</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="it_whois_recent">28.01.2024</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">IP / DNS</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="it_ip_overlap">пересечение с инфраструктурой перевозчика</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Интеграции</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="it_site_template">шаблон, API портов/линий нет</button></div></div><div class="tb-doc-note">Статусы «доставлено» формируются вручную, без независимых источников.</div></div>`},

      {id:'compliance',locked:true,unlockedBy:'compliance',type:'КОМПЛАЕНС',title:'Досье усиленного DD по перевозчику',meta:'Открывается запросом в комплаенс',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">VENDOR DUE DILIGENCE</h2><div class="tb-doc-page-meta">ООО «Транс-Север Логистик»</div><div class="tb-doc-field-row"><div class="tb-doc-label">Парк ТС / лицензии</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="compliance_vendor_shell">не подтверждены (shell-признаки)</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Бенефициар</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="compliance_beneficial_relative">Семёнов И.И. — брат супруги Волкова</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Онбординг</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="compliance_onboarding_skipped">проведён задним числом</button></div></div><div class="tb-doc-note">Конфликт интересов не раскрыт при заключении договора.</div></div>`},

      {id:'whaudit',locked:true,unlockedBy:'warehouse',type:'СКЛАД',title:'Аудит приемки по счетам перевозчика',meta:'Открывается запросом на склад',html:`<div class="tb-doc-page"><h2 class="tb-doc-page-title">WAREHOUSE RECEIPT AUDIT</h2><div class="tb-doc-page-meta">Склад «Северный» · февраль–март</div><div class="tb-doc-field-row"><div class="tb-doc-label">GRN по счетам 1042/1057/1069</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="warehouse_grn_absent">не создан ни по одному</button></div></div><div class="tb-doc-field-row"><div class="tb-doc-label">Подписание актов</div><div class="tb-doc-value"><button class="tb-ev-field" data-ev="warehouse_courier_pattern">один курьер, без вскрытия груза</button></div></div><table class="tb-doc-table"><thead><tr><th>Счёт</th><th>Контейнер</th><th>GRN</th><th>Факт</th></tr></thead><tbody><tr><td>1042</td><td>MSKU7736210</td><td>Нет</td><td>Нет приемки</td></tr><tr><td>1057</td><td>MSKU7736210</td><td>Нет</td><td>Нет приемки</td></tr><tr><td>1069</td><td>MSKU7736210</td><td>Нет</td><td>Нет приемки</td></tr></tbody></table></div>`}
    ],

    /* ---------------- ТРАНЗАКЦИИ: МНОГО ШУМА ----------------
       Полезные строки НЕ выделены. Аномалия видна только при
       сопоставлении получателя, контейнера, трека, срока и GRN.
       Колонки: date, payee, amount, invoice, container, tracking, terms, grn, note
    */
    transactions:[
      {id:'t01',date:'02.02.2024',payee:'Логистик Плюс',amount:'3 900 000 ₽',invoice:'541',container:'MSKU7736188',tracking:'LP-3401',terms:'29 дней',grn:'Да',note:'Штатный маршрут'},
      {id:'t02',date:'03.02.2024',payee:'АО Таможенный партнер',amount:'950 000 ₽',invoice:'770',container:'—',tracking:'—',terms:'30 дней',grn:'Да',note:'Брокерские услуги'},
      {id:'t03',date:'04.02.2024',payee:'Транс-Север Логистик',amount:'17 600 000 ₽',invoice:'1031',container:'MSKU7736209',tracking:'GC-77A1',terms:'26 дней',grn:'Да',note:'Первый счёт, приемка есть'},
      {id:'t04',date:'05.02.2024',payee:'СеверТранс',amount:'5 100 000 ₽',invoice:'220',container:'MSKU7736190',tracking:'ST-9012',terms:'31 день',grn:'Да',note:'Обычный срок'},
      {id:'t05',date:'06.02.2024',payee:'Логистик Плюс',amount:'4 050 000 ₽',invoice:'543',container:'MSKU7736191',tracking:'LP-3403',terms:'28 дней',grn:'Да',note:'—'},
      {id:'t06',date:'07.02.2024',payee:'Транс-Север Логистик',amount:'18 000 000 ₽',invoice:'1035',container:'MSKU7736195',tracking:'GC-77B2',terms:'24 дня',grn:'Да',note:'Приемка подтверждена'},
      {id:'t07',date:'08.02.2024',payee:'Восток-Карго',amount:'6 300 000 ₽',invoice:'310',container:'MSKU7736196',tracking:'VK-2201',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t08',date:'09.02.2024',payee:'Логистик Плюс',amount:'3 700 000 ₽',invoice:'545',container:'MSKU7736197',tracking:'LP-3405',terms:'29 дней',grn:'Да',note:'—'},
      {id:'t09',date:'10.02.2024',payee:'Транс-Север Логистик',amount:'18 400 000 ₽',invoice:'1042',container:'MSKU7736210',tracking:'GC-77X9',terms:'2 дня',grn:'Нет',note:'Срочно, трок «доставлено»'},
      {id:'t10',date:'11.02.2024',payee:'СеверТранс',amount:'4 900 000 ₽',invoice:'222',container:'MSKU7736199',tracking:'ST-9014',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t11',date:'12.02.2024',payee:'Транс-Север Логистик',amount:'17 900 000 ₽',invoice:'1057',container:'MSKU7736210',tracking:'GC-77X9',terms:'1 день',grn:'Нет',note:'Повтор контейнера и трека'},
      {id:'t12',date:'12.02.2024',payee:'Логистик Плюс',amount:'4 200 000 ₽',invoice:'548',container:'MSKU7736200',tracking:'LP-3408',terms:'28 дней',grn:'Да',note:'Похожая сумма, легитимно'},
      {id:'t13',date:'13.02.2024',payee:'Восток-Карго',amount:'6 100 000 ₽',invoice:'312',container:'MSKU7736201',tracking:'VK-2203',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t14',date:'14.02.2024',payee:'Транс-Север Логистик',amount:'18 100 000 ₽',invoice:'1069',container:'MSKU7736210',tracking:'GC-77X9',terms:'2 дня',grn:'Нет',note:'Третий счёт, тот же контейнер'},
      {id:'t15',date:'15.02.2024',payee:'АО Таможенный партнер',amount:'980 000 ₽',invoice:'772',container:'—',tracking:'—',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t16',date:'16.02.2024',payee:'СеверТранс',amount:'5 300 000 ₽',invoice:'224',container:'MSKU7736203',tracking:'ST-9016',terms:'29 дней',grn:'Да',note:'—'},
      {id:'t17',date:'17.02.2024',payee:'Логистик Плюс',amount:'3 950 000 ₽',invoice:'550',container:'MSKU7736204',tracking:'LP-3410',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t18',date:'18.02.2024',payee:'Транс-Север Логистик',amount:'2 300 000 ₽',invoice:'1084',container:'MSKU7736210',tracking:'GC-77X9',terms:'2 дня',grn:'Нет',note:'Сопровождение по тому же треку'},
      {id:'t19',date:'19.02.2024',payee:'Восток-Карго',amount:'6 500 000 ₽',invoice:'314',container:'MSKU7736205',tracking:'VK-2205',terms:'31 день',grn:'Да',note:'—'},
      {id:'t20',date:'20.02.2024',payee:'Транс-Север Логистик',amount:'17 800 000 ₽',invoice:'1091',container:'MSKU7736211',tracking:'GC-77C3',terms:'25 дней',grn:'Да',note:'Легитимный счёт того же перевозчика — шум'},
      {id:'t21',date:'21.02.2024',payee:'Логистик Плюс',amount:'4 100 000 ₽',invoice:'552',container:'MSKU7736212',tracking:'LP-3412',terms:'28 дней',grn:'Да',note:'—'},
      {id:'t22',date:'22.02.2024',payee:'СеверТранс',amount:'5 000 000 ₽',invoice:'226',container:'MSKU7736213',tracking:'ST-9018',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t23',date:'23.02.2024',payee:'Транс-Север Логистик',amount:'18 300 000 ₽',invoice:'1098',container:'MSKU7736210',tracking:'GC-77X9',terms:'2 дня',grn:'Нет',note:'Четвёртый спорный, повтор MSKU7736210'},
      {id:'t24',date:'24.02.2024',payee:'Восток-Карго',amount:'6 200 000 ₽',invoice:'316',container:'MSKU7736214',tracking:'VK-2207',terms:'29 дней',grn:'Да',note:'—'},
      {id:'t25',date:'25.02.2024',payee:'Логистик Плюс',amount:'3 800 000 ₽',invoice:'554',container:'MSKU7736215',tracking:'LP-3414',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t26',date:'26.02.2024',payee:'АО Таможенный партнер',amount:'1 020 000 ₽',invoice:'774',container:'—',tracking:'—',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t27',date:'27.02.2024',payee:'Транс-Север Логистик',amount:'17 700 000 ₽',invoice:'1103',container:'MSKU7736216',tracking:'GC-77D4',terms:'27 дней',grn:'Да',note:'Легитимный — шум'},
      {id:'t28',date:'28.02.2024',payee:'СеверТранс',amount:'5 200 000 ₽',invoice:'228',container:'MSKU7736217',tracking:'ST-9020',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t29',date:'01.03.2024',payee:'Логистик Плюс',amount:'4 300 000 ₽',invoice:'556',container:'MSKU7736218',tracking:'LP-3416',terms:'29 дней',grn:'Да',note:'—'},
      {id:'t30',date:'02.03.2024',payee:'Транс-Север Логистик',amount:'18 200 000 ₽',invoice:'1110',container:'MSKU7736210',tracking:'GC-77X9',terms:'1 день',grn:'Нет',note:'Пятый спорный, снова MSKU7736210'},
      {id:'t31',date:'03.03.2024',payee:'Восток-Карго',amount:'6 400 000 ₽',invoice:'318',container:'MSKU7736219',tracking:'VK-2209',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t32',date:'04.03.2024',payee:'Транс-Север Логистик',amount:'17 950 000 ₽',invoice:'1115',container:'MSKU7736220',tracking:'GC-77E5',terms:'26 дней',grn:'Да',note:'Легитимный — шум'},
      {id:'t33',date:'05.03.2024',payee:'Логистик Плюс',amount:'3 900 000 ₽',invoice:'558',container:'MSKU7736221',tracking:'LP-3418',terms:'28 дней',grn:'Да',note:'—'},
      {id:'t34',date:'06.03.2024',payee:'СеверТранс',amount:'5 100 000 ₽',invoice:'230',container:'MSKU7736222',tracking:'ST-9022',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t35',date:'07.03.2024',payee:'Транс-Север Логистик',amount:'18 050 000 ₽',invoice:'1121',container:'MSKU7736210',tracking:'GC-77X9',terms:'2 дня',grn:'Нет',note:'Шестой спорный, повтор'},
      {id:'t36',date:'08.03.2024',payee:'Восток-Карго',amount:'6 000 000 ₽',invoice:'320',container:'MSKU7736223',tracking:'VK-2211',terms:'29 дней',grn:'Да',note:'—'},
      {id:'t37',date:'09.03.2024',payee:'Логистик Плюс',amount:'4 150 000 ₽',invoice:'560',container:'MSKU7736224',tracking:'LP-3420',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t38',date:'10.03.2024',payee:'АО Таможенный партнер',amount:'990 000 ₽',invoice:'776',container:'—',tracking:'—',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t39',date:'11.03.2024',payee:'Транс-Север Логистик',amount:'17 600 000 ₽',invoice:'1128',container:'MSKU7736225',tracking:'GC-77F6',terms:'25 дней',grn:'Да',note:'Легитимный — шум'},
      {id:'t40',date:'12.03.2024',payee:'СеверТранс',amount:'5 400 000 ₽',invoice:'232',container:'MSKU7736226',tracking:'ST-9024',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t41',date:'13.03.2024',payee:'Логистик Плюс',amount:'3 850 000 ₽',invoice:'562',container:'MSKU7736227',tracking:'LP-3422',terms:'29 дней',grn:'Да',note:'—'},
      {id:'t42',date:'14.03.2024',payee:'Транс-Север Логистик',amount:'18 150 000 ₽',invoice:'1134',container:'MSKU7736210',tracking:'GC-77X9',terms:'1 день',grn:'Нет',note:'Седьмой спорный, повтор MSKU7736210'},
      {id:'t43',date:'15.03.2024',payee:'Восток-Карго',amount:'6 300 000 ₽',invoice:'322',container:'MSKU7736228',tracking:'VK-2213',terms:'30 дней',grn:'Да',note:'—'},
      {id:'t44',date:'16.03.2024',payee:'Логистик Плюс',amount:'4 000 000 ₽',invoice:'564',container:'MSKU7736229',tracking:'LP-3424',terms:'28 дней',grn:'Да',note:'—'},
      {id:'t45',date:'17.03.2024',payee:'Транс-Север Логистик',amount:'17 850 000 ₽',invoice:'1140',container:'MSKU7736230',tracking:'GC-77G7',terms:'27 дней',grn:'Да',note:'Легитимный — шум'}
    ],

    /* ---------------- ОФИЦИАЛЬНЫЕ ЗАПРОСЫ ----------------
       requires: массив ev-id, которые должны быть в доказательственной
       базе, иначе запрос ОТКЛОНЯЕТСЯ (тратит время, но не лимит обращений).
       unlocks: массив id документов, которые становятся доступны при одобрении.
    */
    requests:[
      {id:'logistics',title:'Независимое расписание судна и dispatch log',target:'Служба логистики / судоходная линия',desc:'Запросить плановые даты выхода судна по коносаменту и журнал бронирований контейнера.',requires:['bol_issue_date','invoice_tracking_id'],unlocks:['schedule','dispatch'],timeCost:20,success:'Логистика предоставила расписание судна и dispatch log.',reject:'Отклонено: не указаны конкретный коносамент и трек для сверки. Соберите данные BOL и счета.'},
      {id:'bank',title:'Bank trail по счёту перевозчика',target:'Обслуживающий банк (по регламенту)',desc:'Запросить историю движения средств по счёту получателя аномальных платежей.',requires:['payment_before_grn'],unlocks:['banktrail'],timeCost:25,success:'Банк предоставил trail по счёту перевозчика.',reject:'Отклонено: нет основания — не зафиксированы платежи без приемки. Сначала соберите реестр/three-way.'},
      {id:'customs',title:'Таможенный risk-отчёт по декларации',target:'Таможенный брокер / ФТС-канал',desc:'Проверить профиль риска, факт досмотра и законность ручного выпуска по спорной ДТ.',requires:['invoice_container_reuse'],unlocks:['customsrisk'],timeCost:20,success:'Получен risk-отчёт по декларации.',reject:'Отклонено: не указан спорный контейнер/ДТ. Сначала выявите повтор реквизитов в счетах.'},
      {id:'it',title:'Digital forensics по трекинг-сервису',target:'IT / внутренняя forensic-группа',desc:'Проанализировать домен, IP и интеграции сайта отслеживания, указанного в счетах.',requires:['invoice_tracking_id'],unlocks:['itforensics'],timeCost:25,success:'IT провело анализ трекинг-сервиса.',reject:'Отклонено: нет трек-ID для анализа. Укажите tracking ID из счета.'},
      {id:'compliance',title:'Усиленный DD по новому перевозчику',target:'Комплаенс / служба безопасности',desc:'Проверить бенефициаров, парк ТС, лицензии и корректность онбординга поставщика.',requires:['vendor_new','vendor_mass_address'],unlocks:['compliance'],timeCost:25,success:'Комплаенс раскрыл бенефициаров и статус онбординга.',reject:'Отклонено: недостаточно регистровых признаков для запуска усиленного DD. Соберите данные ЕГРЮЛ.'},
      {id:'warehouse',title:'Аудит складской приемки по счетам',target:'Склад «Северный» / операционный аудит',desc:'Проверить наличие GRN и порядок подписания актов по оплаченным счетам перевозчика.',requires:['payment_before_grn','three_way_mismatch'],unlocks:['whaudit'],timeCost:20,success:'Складской аудит подтвердил отсутствие GRN.',reject:'Отклонено: нет основания для аудита приемки. Сначала зафиксируйте оплату без GRN и нарушение matching.'}
    ]
  }
};
</script>
