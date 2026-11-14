/* собрано tools/build.py — не править руками; исходник: src/venues/demo-almaty/venue.js */
/* ================= демо-профиль для владельцев баров: ?bar=demo-almaty =================
   Вымышленный коктейльный бар в Алматы на той же 3D-сцене, что и Hacheden: своё название на вывесках,
   цены в тенге, бронь мест и барный пропуск включены для всех гостей.
   Цены условные — ориентир для коктейльного бара в Алматы, не предложение и не прайс настоящего заведения.
   Для теста брони впишите в contacts свои WhatsApp (номер в международном виде без «+», например 77011234567)
   и Telegram (имя без «@»): заявки придут вам, в начале текста будет пометка «[Тест с демо-страницы]». */
  VENUE_PATCHES.push({
    id: "demo-almaty",
    base: "hacheden",
    make: base => {
      /* ₸ за порцию: классика, фирменный, безалкогольные и горячие */
      const PRICE = {
        "c-hacheden": 6500, "c-mojito": 4200, "c-daiquiri": 4200, "c-cubalibre": 3500, "c-pinacolada": 4500,
        "c-junglebird": 4800, "c-margarita": 4500, "c-sunrise": 3900, "c-gintonic": 3800, "c-negroni": 4800,
        "c-martini": 4900, "c-collins": 4200, "c-oldfashioned": 5200, "c-manhattan": 5200, "c-sour": 4800,
        "c-pisco": 5500, "c-sidecar": 5200, "c-sangria": 3500, "c-nojito": 2500, "c-irish": 3800,
        "c-toddy": 3500, "c-coffee": 1500, "c-tea": 1800
      };
      const menu = base.menu.map(c => {
        const d = Object.assign({}, c, PRICE[c.id] ? { price: PRICE[c.id].toLocaleString("ru-RU") } : {});
        if (c.id === "c-hacheden") Object.assign(d, { name: "Алатау", origin: "Наш бар",
          history: "Фирменный коктейль бара. Огненная подача — дань «Блю Блейзеру» Джерри Томаса: в его книге 1862 года, первом пособии для барменов, горящий виски переливают между двумя кружками высокой огненной струёй." });
        return d;
      });
      return {
        meta: {
          name: "Алатау",
          sign: "Алатау",
          slogan: "Коктейльный бар у подножия гор",
          intro: "Камерный коктейльный бар в Алматы — демо платформы. Афиша вечера, барный пропуск с комплиментом за визит и бары сети работают так же, как в настоящем заведении.",
          city: "Алматы",
          address: "Алматы · адрес укажет заведение",
          hours: { open: "17:00", close: "03:00", last: "02:30" },
          site: "hacheden.github.io/?bar=demo-almaty",
          contacts: Object.assign({}, DEMO_CONTACTS),   // тестовые контакты — в src/venues/00-registry.js (DEMO_CONTACTS)
          currency: "₸",
          codePrefix: "ALT",
          district: "Алматы · Медеуский район",
          /* что гость получает по барному пропуску: хостес или бармен отмечает код — так бар считает гостей с платформы */
          privilege: "Комплимент от шеф-бармена при первом визите",
          demo: true
        },
        /* афиша на ближайшие выходные (даты считаются от сегодняшнего дня — демо всегда свежее); у настоящего бара — обычные даты "гггг-мм-дд" */
        events: (() => {
          const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const day = wd => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + ((wd - d.getDay() + 7) % 7)); return iso(d); };
          return [
            { title: "Джаз на бархате", date: day(5), time: "21:00", lineup: "Трио Асель Нурлановой: рояль, контрабас, барабаны",
              desc: "Стандарты 1920-х и 1950-х в живом звуке. Два сета, между ними бармен показывает огненную подачу «Алатау».", accent: "#d6aa5c" },
            { title: "Ночь сауэров", date: day(6), time: "20:00", lineup: "Шеф-бармен и гость из Астаны",
              desc: "Виски сауэр, писко сауэр и сезонный сауэр на облепихе: история каждого и мастер-класс по белковой пене у стойки.", accent: "#e0603a" }
          ];
        })(),
        /* бары сети: спичечные коробки в футляре — переход в один клик */
        network: [
          { id: "hacheden", name: "Hacheden", tagline: "Бар, которого нет на карте", district: "Онлайн · спикизи 1920-х" }
        ],
        menu,
        /* камерный зал: только бар (залы — src/venues/demo-almaty/rooms; улицы, читальни, курилки, сцены и погреба нет) */
        rooms: [Object.assign({}, base.rooms.find(r => r.id === "bar"), {
          audio: { rain: 0, fire: 0, clinks: 1 },
          /* афиша в зале: латунная рама на стойке слева от меню (табличка спешла отходит левее) — видна и с телефона */
          eventStand: { pos: [-.85, -2.25], rot: .14, kind: "counter" }
        })],
        features: { street: false, nook: false, smoke: false, stage: false, cellar: false, bartenderShow: true, booking: false, quests: false, liveBar: true }
      };
    }
  });
