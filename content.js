<script>
/* =================================================================
   ДОПОЛНИТЕЛЬНЫЕ УЛИКИ ИЗ ИНТЕРВЬЮ И АНАЛИЗА
   ================================================================= */
Object.assign(EV_LIBRARY, {
  accountant_followed_procurement: {
    title: 'Бухгалтер проводил платежи по указанию закупки без независимой приемки',
    source: 'Интервью: Соколов П.И.',
    reliability: 'medium',
    weight: 8,
    tags: ['process', 'override']
  },
  accountant_noticed_duplicate_refs: {
    title: 'Бухгалтер замечал повтор контейнера и трека, но не эскалировал',
    source: 'Интервью: Соколов П.И.',
    reliability: 'medium',
    weight: 8,
    tags: ['invoice', 'pattern']
  },
  accountant_override_instruction: {
    title: 'Бухгалтер получил установку не блокировать оплату по three-way mismatch',
    source: 'Интервью: Соколов П.И.',
    reliability: 'high',
    weight: 10,
    tags: ['control', 'override']
  },
  volkov_refuses_explain_bank: {
    title: 'Волков уклонился от объяснений по транзитным платежам перевозчика',
    source: 'Интервью: Волков А.П.',
    reliability: 'medium',
    weight: 7,
    tags: ['statement', 'evasion']
  },
  warehouse_no_gate_record: {
    title: 'Склад не видит записей о въезде транспорта по спорным контейнерам',
    source: 'Интервью: Соколова М.И.',
    reliability: 'medium',
    weight: 8,
    tags: ['warehouse', 'access']
  },
  noise_accountant_workload: {
    title: 'Бухгалтер жалуется на высокую нагрузку в конце месяца',
    source: 'Интервью: Соколов П.И.',
    reliability: 'low',
    weight: 0,
    tags: ['noise'],
    noise: true
  },
  noise_volkov_style: {
    title: 'Волков общается директивно и не любит долгие согласования',
    source: 'Интервью: Волков А.П.',
    reliability: 'low',
    weight: 0,
    tags: ['noise'],
    noise: true
  }
});

/* =================================================================
   ИНТЕРВЬЮ
   Доступно 4 персонажа, но провести можно только 3.
   Некоторые вопросы открываются только после сбора конкретных улик
   или одобрения официальных запросов.
   ================================================================= */
CASES_DB['case-1'].interviews = {
  volkov: {
    id: 'volkov',
    name: 'Волков Артём Петрович',
    role: 'Директор по закупкам',
    initials: 'ВА',
    desc: 'Инициировал договор с перевозчиком, подписывал документы и настаивал на быстрой оплате.',
    startNode: 'vk_start',
    nodes: {
      vk_start: {
        text: `Я не понимаю, о чём вы. У нас стояла производственная линия, поставки были критичными. Трекинг показывал доставку, поэтому я дал команду ускорить оплату. Это нормальное управленческое решение.`,
        add: ['volkov_claim_urgent', 'volkov_claim_tracking_confirmed', 'noise_volkov_style'],
        choices: [
          {
            text: 'Почему срок оплаты 2 дня, если политика требует 30 дней после GRN?',
            next: 'vk_payment',
            requires: 'payment_terms_2_days',
            lockedText: 'Сначала найдите договор или политику оплаты.'
          },
          {
            text: 'Вы знали, что бенефициар перевозчика связан с вами лично?',
            next: 'vk_relation',
            requires: 'compliance_beneficial_relative',
            lockedText: 'Нужно подтверждение бенефициаров из комплаенс-досье.'
          },
          {
            text: 'Склад не подтверждает приемку. Как вы объясните статус “доставлено”?',
            next: 'vk_no_receipt',
            requiresAny: ['warehouse_grn_absent', 'warehouse_confirms_no_receipt'],
            lockedText: 'Нужно подтверждение отсутствия приемки со склада или аудита GRN.'
          },
          {
            text: 'Кто независимо проверял трекинг-сервис ts-tracking.online?',
            next: 'vk_tracking',
            requires: 'invoice_tracking_id',
            lockedText: 'Сначала возьмите tracking ID из счета.'
          },
          {
            text: 'Почему часть платежей уходила на связанные юрлица сразу после зачисления?',
            next: 'vk_bank',
            requires: 'bank_payment_trail_round_trip',
            lockedText: 'Нужен bank trail по счёту перевозчика.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      vk_payment: {
        text: `Я попросил Павла провести быстрее. Формально это было исключение, но я был уверен, что груз в пути. Линия не могла ждать.`,
        add: ['volkov_pressured_accountant'],
        choices: [
          {
            text: 'Вы знали, что бенефициар перевозчика связан с вами лично?',
            next: 'vk_relation',
            requires: 'compliance_beneficial_relative',
            lockedText: 'Нужно подтверждение бенефициаров из комплаенс-досье.'
          },
          {
            text: 'Склад не подтверждает приемку. Как вы объясните статус “доставлено”?',
            next: 'vk_no_receipt',
            requiresAny: ['warehouse_grn_absent', 'warehouse_confirms_no_receipt'],
            lockedText: 'Нужно подтверждение отсутствия приемки со склада или аудита GRN.'
          },
          {
            text: 'Кто независимо проверял трекинг-сервис?',
            next: 'vk_tracking',
            requires: 'invoice_tracking_id',
            lockedText: 'Сначала возьмите tracking ID из счета.'
          },
          {
            text: 'Почему часть платежей уходила на связанные юрлица?',
            next: 'vk_bank',
            requires: 'bank_payment_trail_round_trip',
            lockedText: 'Нужен bank trail по счёту перевозчика.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      vk_relation: {
        text: `Да, Семёнов — брат моей жены. Но он не просил меня о контракте. Я выбирал перевозчика по цене, срокам и готовности взять срочные объёмы. Я считал это бытовым совпадением.`,
        add: ['volkov_admits_relative'],
        choices: [
          {
            text: 'Вы подписали договор и требовали ускоренной оплаты. Это конфликт интересов.',
            next: 'vk_no_receipt',
            requiresAny: ['warehouse_grn_absent', 'warehouse_confirms_no_receipt'],
            lockedText: 'Нужно подтверждение отсутствия приемки, чтобы связать конфликт интересов с операцией.'
          },
          {
            text: 'Почему часть платежей уходила на связанные юрлица?',
            next: 'vk_bank',
            requires: 'bank_payment_trail_round_trip',
            lockedText: 'Нужен bank trail по счёту перевозчика.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      vk_no_receipt: {
        text: `Может быть, склад ошибся с оформлением. Или документы потерялись. Трек всё равно показывал статус “доставлено”. Я не обязан лично стоять на рампе.`,
        add: ['volkov_contradicts_warehouse'],
        choices: [
          {
            text: 'Кто независимо проверял трекинг-сервис?',
            next: 'vk_tracking',
            requires: 'invoice_tracking_id',
            lockedText: 'Сначала возьмите tracking ID из счета.'
          },
          {
            text: 'Почему часть платежей уходила на связанные юрлица?',
            next: 'vk_bank',
            requires: 'bank_payment_trail_round_trip',
            lockedText: 'Нужен bank trail по счёту перевозчика.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      vk_tracking: {
        text: `Сайт предоставил перевозчик. Я не пробивал домен, не проверял API портов и не звонил в судоходную линию. Мне казалось, что это стандартный логистический сервис.`,
        add: ['volkov_no_independent_verification'],
        choices: [
          {
            text: 'Почему часть платежей уходила на связанные юрлица?',
            next: 'vk_bank',
            requires: 'bank_payment_trail_round_trip',
            lockedText: 'Нужен bank trail по счёту перевозчика.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      vk_bank: {
        text: `Я не вижу движений по счетам поставщика. Это банковская тайна и их внутренние расчёты. Если банк что-то видит, пусть сам и отвечает.`,
        add: ['volkov_refuses_explain_bank'],
        choices: [
          { text: 'Завершить интервью', next: 'END' }
        ]
      }
    }
  },

  warehouse: {
    id: 'warehouse',
    name: 'Соколова Мария Игоревна',
    role: 'Начальник склада «Северный»',
    initials: 'СМ',
    desc: 'Отвечает за фактическую приемку грузов и оформление GRN.',
    startNode: 'wh_start',
    nodes: {
      wh_start: {
        text: `По контейнеру MSKU7736210 у нас нет приходного ордера. Груз физически не поступал. Я не понимаю, как бухгалтерия могла оплатить услуги, если склад ничего не принял.`,
        add: ['warehouse_confirms_no_receipt'],
        choices: [
          {
            text: 'Кто подписывал акты оказанных услуг?',
            next: 'wh_courier',
            lockedText: ''
          },
          {
            text: 'Были ли другие реальные поставки от «Транс-Север»?',
            next: 'wh_other',
            lockedText: ''
          },
          {
            text: 'Есть ли записи о въезде транспорта по спорным контейнерам?',
            next: 'wh_gate',
            requires: 'dispatch_log_no_booking',
            lockedText: 'Нужен dispatch log или подтверждение отсутствия брони.'
          },
          {
            text: 'Совпадают ли даты складских операций с расписанием судна?',
            next: 'wh_dates',
            requires: 'vessel_schedule_mismatch',
            lockedText: 'Нужно независимое расписание судна.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      wh_courier: {
        text: `Документы привозил курьер. Он подписал, что передал бумаги, но не груз. Наши кладовщики не вскрывали контейнер, потому что его не было на рампе.`,
        add: ['warehouse_courier_signature'],
        choices: [
          {
            text: 'Были ли другие реальные поставки от «Транс-Север»?',
            next: 'wh_other',
            lockedText: ''
          },
          {
            text: 'Есть ли записи о въезде транспорта по спорным контейнерам?',
            next: 'wh_gate',
            requires: 'dispatch_log_no_booking',
            lockedText: 'Нужен dispatch log или подтверждение отсутствия брони.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      wh_other: {
        text: `Нет. Все нормальные поставки шли через старых перевозчиков. От «Транс-Север» я вижу только бумаги, счета и странные подписи курьеров.`,
        add: ['warehouse_no_other_shipments'],
        choices: [
          {
            text: 'Есть ли записи о въезде транспорта по спорным контейнерам?',
            next: 'wh_gate',
            requires: 'dispatch_log_no_booking',
            lockedText: 'Нужен dispatch log или подтверждение отсутствия брони.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      wh_gate: {
        text: `Если в диспетчерском журнале нет брони, то и на рампу машина не приезжала. У нас ворота фиксируют въезд, но по этим номерам пусто.`,
        add: ['warehouse_no_gate_record'],
        choices: [
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      wh_dates: {
        text: `Я не смотрю расписание судов. Но если коносамент выпущен раньше выхода судна, а груз не пришёл, это не задержка. Это отсутствие операции.`,
        add: ['warehouse_confirms_no_receipt'],
        choices: [
          { text: 'Завершить интервью', next: 'END' }
        ]
      }
    }
  },

  it: {
    id: 'it',
    name: 'Лебедева Анна Сергеевна',
    role: 'IT-аудитор / digital forensics',
    initials: 'ЛА',
    desc: 'Может прокомментировать цифровой след трекинг-сервиса, но только при наличии конкретных идентификаторов.',
    startNode: 'it_start',
    nodes: {
      it_start: {
        text: `Я готова комментарий по цифровому следу, но мне нужен конкретный URL, домен или tracking ID. Без идентификатора это гадание.`,
        choices: [
          {
            text: 'Прокомментируйте сайт ts-tracking.online и трек GC-77X9.',
            next: 'it_site',
            requires: 'invoice_tracking_id',
            lockedText: 'Сначала возьмите tracking ID из счета.'
          },
          {
            text: 'Что говорит WHOIS по домену?',
            next: 'it_domain',
            requires: 'it_whois_recent',
            lockedText: 'Нужен ответ IT-форензики по домену.'
          },
          {
            text: 'Есть ли пересечение IP-инфраструктуры с перевозчиком?',
            next: 'it_ip',
            requires: 'it_ip_overlap',
            lockedText: 'Нужен IT-анализ IP/DNS.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      it_site: {
        text: `Интерфейс выглядит правдоподобно, но это витрина. Нет интеграций с портами, судоходными линиями или таможенными API. Статусы можно выставлять вручную.`,
        add: ['it_confirms_fake_tracking'],
        choices: [
          {
            text: 'Что говорит WHOIS по домену?',
            next: 'it_domain',
            requires: 'it_whois_recent',
            lockedText: 'Нужен ответ IT-форензики по домену.'
          },
          {
            text: 'Есть ли пересечение IP-инфраструктуры с перевозчиком?',
            next: 'it_ip',
            requires: 'it_ip_overlap',
            lockedText: 'Нужен IT-анализ IP/DNS.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      it_domain: {
        text: `Домен зарегистрирован слишком поздно для сервиса, который якобы сопровождает перевозки несколько месяцев. Это не обязательно fraud, но сильно снижает доверие.`,
        add: ['it_domain_registered_after_contract'],
        choices: [
          {
            text: 'Есть ли пересечение IP-инфраструктуры с перевозчиком?',
            next: 'it_ip',
            requires: 'it_ip_overlap',
            lockedText: 'Нужен IT-анализ IP/DNS.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      it_ip: {
        text: `DNS и IP пересекаются с облачной инфраструктурой, которую использовал перевозчик. Прямого владения нет, но зависимость от одного контура очевидна.`,
        add: ['it_ip_vendor_confirmed'],
        choices: [
          { text: 'Завершить интервью', next: 'END' }
        ]
      }
    }
  },

  accountant: {
    id: 'accountant',
    name: 'Соколов Павел Иванович',
    role: 'Ведущий бухгалтер по расчетам с поставщиками',
    initials: 'СП',
    desc: 'Проводил платежи по логистике и видел нарушения процедуры, но действовал по указанию.',
    startNode: 'acc_start',
    nodes: {
      acc_start: {
        text: `Я проводил платежи по документам, которые приходили из закупки. Если Волков писал «срочно», я старался не блокировать. Но формальных оснований для оплаты без GRN не было.`,
        add: ['noise_accountant_workload'],
        choices: [
          {
            text: 'Почему вы оплатили счёт без подтверждённой приемки?',
            next: 'acc_grn',
            requires: 'payment_before_grn',
            lockedText: 'Сначала зафиксируйте оплату без GRN.'
          },
          {
            text: 'Вы получали письмо от Волкова 11 февраля?',
            next: 'acc_email',
            requires: 'email_expedite',
            lockedText: 'Нужна переписка с требованием ускорить оплату.'
          },
          {
            text: 'Вы замечали повтор контейнера MSKU7736210 и трека GC-77X9?',
            next: 'acc_dup',
            requires: 'invoice_container_reuse',
            lockedText: 'Нужно выявить повтор реквизитов в счетах.'
          },
          {
            text: 'Вам говорили не обращать внимание на three-way mismatch?',
            next: 'acc_override',
            requires: 'three_way_mismatch',
            lockedText: 'Нужен отчет о нарушении three-way matching.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      acc_grn: {
        text: `Да, я видел, что GRN нет. Но мне сказали, что склад докумитирует позже. Я не хотел останавливать оплату и писать эскалацию на директора по закупкам.`,
        add: ['accountant_followed_procurement'],
        choices: [
          {
            text: 'Вы получали письмо от Волкова 11 февраля?',
            next: 'acc_email',
            requires: 'email_expedite',
            lockedText: 'Нужна переписка с требованием ускорить оплату.'
          },
          {
            text: 'Вы замечали повтор контейнера и трека?',
            next: 'acc_dup',
            requires: 'invoice_container_reuse',
            lockedText: 'Нужно выявить повтор реквизитов в счетах.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      acc_email: {
        text: `Письмо было. Там прямо просили провести до проверки. Я понял, что это давление, но списал на срочность производства. Теперь понимаю, что это должен был быть стоп-фактор.`,
        add: ['volkov_pressured_accountant'],
        choices: [
          {
            text: 'Вам говорили не обращать внимание на three-way mismatch?',
            next: 'acc_override',
            requires: 'three_way_mismatch',
            lockedText: 'Нужен отчет о нарушении three-way matching.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      acc_dup: {
        text: `Я видел одинаковые контейнер и трек в разных счетах. Мне показалось, что это ошибка ввода или один маршрут разбит на документы. Я не стал углубляться.`,
        add: ['accountant_noticed_duplicate_refs'],
        choices: [
          {
            text: 'Вам говорили не обращать внимание на three-way mismatch?',
            next: 'acc_override',
            requires: 'three_way_mismatch',
            lockedText: 'Нужен отчет о нарушении three-way matching.'
          },
          { text: 'Завершить интервью', next: 'END' }
        ]
      },

      acc_override: {
        text: `Мне сказали, что matching можно закрыть позже, лишь бы не задержать перевозчика. Это было неформальное указание, но для меня оно работало как разрешение.`,
        add: ['accountant_override_instruction'],
        choices: [
          { text: 'Завершить интервью', next: 'END' }
        ]
      }
    }
  }
};

/* =================================================================
   КОНТРОЛИ
   good: true — сильные, пропорциональные контроли.
   good: false — опасные, несоразмерные или этически проблемные решения.
   ================================================================= */
CASES_DB['case-1'].controls = [
  {
    id: 'three_way_hard_stop',
    text: 'Жёсткий блок оплаты логистики без подтверждённого GRN в ERP',
    desc: 'Восстанавливает базовый three-way matching и не позволяет оплачивать “воздух”',
    good: true
  },
  {
    id: 'gps_dispatch_reconciliation',
    text: 'Регулярная сверка GPS/telematics, dispatch log и складских приходных ордеров',
    desc: 'Выявляет фиктивные перевозки до оплаты или на ранней стадии',
    good: true
  },
  {
    id: 'vendor_enhanced_dd',
    text: 'Усиленный due diligence новых перевозчиков: бенефициары, парк ТС, лицензии, портовые соглашения',
    desc: 'Снижает риск related-party fraud и shell-компаний',
    good: true
  },
  {
    id: 'independent_tracking_verification',
    text: 'Независимая проверка трекинг-ссылок через API перевозчика/порта, а не только сайт поставщика',
    desc: 'Противодействует поддельным сайтам отслеживания',
    good: true
  },
  {
    id: 'payment_exception_workflow',
    text: 'Любое сокращение срока оплаты — только через финансового директора с письменным обоснованием',
    desc: 'Закрывает обход политики 30 дней и давление на бухгалтерию',
    good: true
  },
  {
    id: 'sod_procurement',
    text: 'Разделить инициацию поставщика, подписание договора, утверждение оплаты и master data',
    desc: 'Устраняет концентрацию полномочий у Волкова',
    good: true
  },
  {
    id: 'domain_freshness_monitoring',
    text: 'Мониторинг свежести доменов, IP и инфраструктуры цифровых сервисов поставщиков',
    desc: 'Помогает выявлять сайты-однодневки и hand-rolled tracking portals',
    good: true
  },
  {
    id: 'duplicate_container_analytics',
    text: 'Аналитика повторов контейнеров, tracking ID, счетов и дат в логистических платежах',
    desc: 'Ловит pattern, который вручную легко пропустить',
    good: true
  },
  {
    id: 'blind_warehouse_counts',
    text: 'Периодические слепые инвентаризации и сверка актов с фактическим движением ворот/рампы',
    desc: 'Проверяет, что подписанные документы соответствуют физическому миру',
    good: true
  },
  {
    id: 'transit_payment_monitoring',
    text: 'Мониторинг транзитных исходящих платежей новых поставщиков сразу после входящих',
    desc: 'Выявляет признаки round-trip или вывода через связанные юрлица',
    good: true
  },
  {
    id: 'whistleblower_protection',
    text: 'Усилить канал сообщений о конфликте интересов и защите информаторов',
    desc: 'Повышает шанс раннего обнаружения подобных схем',
    good: true
  },
  {
    id: 'fire_volkov',
    text: 'Немедленно уволить директора по закупкам без служебного расследования',
    desc: 'Может уничтожить доказательства, нарушить трудовые процедуры и создать правовой риск',
    good: false
  },
  {
    id: 'ban_foreign_carriers',
    text: 'Запретить всех иностранных перевозчиков и импортные маршруты',
    desc: 'Несоразмерно риску и парализует бизнес',
    good: false
  },
  {
    id: 'pay_faster_all',
    text: 'Увеличить скорость оплаты всех поставщиков, чтобы избегать остановок производства',
    desc: 'Создаёт системный риск мошенничества и обхода контролей',
    good: false
  },
  {
    id: 'manual_all_cfo',
    text: 'Проверять каждую международную перевозку вручную силами финдиректора',
    desc: 'Немасштабируемо, вызывает alert fatigue и создаёт bottleneck',
    good: false
  },
  {
    id: 'ignore_small_duplicates',
    text: 'Игнорировать повторы контейнеров, если суммы выглядят правдоподобно',
    desc: 'Прямо противоречит логике выявления фиктивной логистики',
    good: false
  },
  {
    id: 'trust_supplier_portal',
    text: 'Считать сайт поставщика достаточным подтверждением доставки',
    desc: 'Наивный контроль, который синдикаты активно эксплуатируют',
    good: false
  },
  {
    id: 'punish_warehouse',
    text: 'Наказать склад за то, что они не приняли несуществующий груз',
    desc: 'Логически абсурдно и демотивирует персонал сообщать о проблемах',
    good: false
  },
  {
    id: 'retroactive_approval',
    text: 'Ретроактивно согласовать все спорные платежи как “производственную необходимость”',
    desc: 'Легализует обход контролей и повторяет ошибку',
    good: false
  },
  {
    id: 'collect_family_data',
    text: 'Собирать персональные данные родственников сотрудников без правового основания',
    desc: 'Этически и юридически проблемный контроль',
    good: false
  }
];

/* =================================================================
   ГИПОТЕЗЫ
   ================================================================= */
const SUGGESTED_HYPOTHESES = [
  {
    id: 'tbml_phantom_logistics',
    title: 'Trade-based money laundering через фантомную логистику и связанного перевозчика',
    desc: 'Перевозчик создал видимость международных поставок электроники/драгметаллов с помощью поддельных документов, фейкового трекинга и связанных юрлиц. Компания оплачивала несуществующие перевозки, а средства выводились через транзитные платежи.',
    required: [
      'warehouse_grn_absent',
      'vessel_schedule_mismatch',
      'it_site_template',
      'compliance_beneficial_relative',
      'bank_payment_trail_round_trip'
    ],
    optional: [
      'dispatch_log_no_booking',
      'customs_no_inspection_record',
      'email_expedite',
      'volkov_admits_relative',
      'three_way_mismatch',
      'payment_before_grn',
      'warehouse_courier_pattern',
      'it_ip_overlap',
      'accountant_followed_procurement',
      'accountant_noticed_duplicate_refs',
      'accountant_override_instruction'
    ],
    devilsAdvocate: 'Груз мог задержаться на таможне, GPS-трекер мог быть неисправен, сайт мог быть кустарным порталом небольшого перевозчика, а родство — совпадением. Без независимого подтверждения отсутствия движения груза и транзитных платежей вывод о TBML преждевременен.',
    refutationAll: [
      'warehouse_grn_absent',
      'dispatch_log_no_booking',
      'it_site_template',
      'bank_payment_trail_round_trip'
    ],
    correct: true
  },
  {
    id: 'operational_error',
    title: 'Операционная ошибка: дублирование документов и задержка GRN',
    desc: 'Возможно, склады и бухгалтерия не синхронизировали документы, а повтор контейнеров — ошибка ввода. Умысел не доказан.',
    required: [
      'payment_before_grn',
      'three_way_mismatch'
    ],
    optional: [
      'invoice_container_reuse',
      'accountant_override_instruction',
      'warehouse_courier_signature'
    ],
    devilsAdvocate: 'Дубли и задержки GRN случаются. Но они не объясняют свежий домен, отсутствие брони в dispatch log, транзитные платежи и нераскрытый конфликт интересов.',
    refutationAll: [
      'it_site_template',
      'compliance_beneficial_relative',
      'bank_payment_trail_round_trip'
    ],
    correct: false
  },
  {
    id: 'legitimate_urgent',
    title: 'Легитимная срочная логистика из-за остановки производства',
    desc: 'Волков утверждает, что платил быстро, чтобы не остановить линию. Возможно, это управленческое решение в кризисной ситуации.',
    required: [
      'volkov_claim_urgent',
      'payments_rapid'
    ],
    optional: [
      'email_expedite',
      'volkov_pressured_accountant'
    ],
    devilsAdvocate: 'Срочность может быть реальной. Но если склад не получил груз, судно не выходило по расписанию, а трек фейковый, срочность становится прикрытием для вывода средств.',
    refutationAll: [
      'warehouse_grn_absent',
      'vessel_schedule_mismatch',
      'it_site_template'
    ],
    correct: false
  },
  {
    id: 'external_fraud_no_internal',
    title: 'Внешнее мошенничество перевозчика без участия сотрудников',
    desc: 'Перевозчик мог самостоятельно подделать документы и трек, а сотрудники стали жертвами обмана.',
    required: [
      'vendor_new',
      'vendor_mass_address'
    ],
    optional: [
      'compliance_vendor_shell',
      'compliance_onboarding_skipped'
    ],
    devilsAdvocate: 'Внешний fraud возможен. Но он не объясняет, почему договор инициировал и подписывал Волков, почему он давил на бухгалтерию и почему бенефициар оказался его родственником.',
    refutationAll: [
      'compliance_beneficial_relative',
      'volkov_admits_relative',
      'email_expedite'
    ],
    correct: false
  }
];
</script>
