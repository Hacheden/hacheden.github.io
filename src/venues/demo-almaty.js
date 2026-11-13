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
          intro: "Демо-версия платформы: вымышленный коктейльный бар в Алматы. Цены условные; бронь места и барный пропуск показывают, как всё работает в настоящем заведении.",
          city: "Алматы",
          address: "Алматы · адрес укажет заведение",
          hours: { open: "17:00", close: "03:00", last: "02:30" },
          site: "hacheden.github.io/?bar=demo-almaty",
          contacts: { whatsapp: "", telegram: "" },   // ← тестовые контакты для показа брони
          currency: "₸",
          codePrefix: "ALT",
          demo: true
        },
        menu
      };
    }
  });
