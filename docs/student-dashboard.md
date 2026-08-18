# The student dashboard — visual and content guide

What a signed-in student sees at `/dashboard`, how it is put together, and the
rules the design follows. Arabic-only, right-to-left, one light theme.

---

## The shell

Every dashboard screen sits inside the same frame:

| Region                           | Contents                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| **Side rail** (right, since RTL) | Brand mark, then six navigation items                                                        |
| **Top bar**                      | The current section's name and icon, the student's name and avatar initial, and تسجيل الخروج |
| **Body**                         | The screen itself                                                                            |

The six destinations, each with its own icon and hue:

| #   | Label    | Route                   | Hue     |
| --- | -------- | ----------------------- | ------- |
| 1   | الرئيسية | `/dashboard`            | blue    |
| 2   | دوراتي   | `/dashboard/courses`    | blue    |
| 3   | محاكياتي | `/dashboard/simulators` | teal    |
| 4   | محاولاتي | `/dashboard/attempts`   | gold    |
| 5   | طلباتي   | `/dashboard/orders`     | neutral |
| 6   | حسابي    | `/dashboard/account`    | neutral |

The active item is marked by its hue **and** a rule, never by colour alone.

---

## The colour code

This is the single idea the visual design rests on. Four hues, each with a fixed
published meaning, used in the order the study method runs:

| Hue         | Means                  | Appears on     |
| ----------- | ---------------------- | -------------- |
| **Blue**    | opening the sequence   | courses        |
| **Teal**    | the exam-day rehearsal | simulators     |
| **Gold**    | effort                 | attempts       |
| **Green**   | readiness              | the best score |
| **Neutral** | not part of the method | orders         |

A purchase stays deliberately colourless: buying is not one of the four
movements, so orders never borrow one of the hues.

**Colour is never the only channel.** Every tile, chip and badge carries its own
icon _and_ its own Arabic label, so the whole surface survives greyscale and
colour-blindness. Nothing here is legible only by hue.

---

## الرئيسية — the overview

The one screen designed to be worth arriving at. Everything else in the student
area is a record, and stays quiet on purpose.

### 1. The greeting band

A panel with a gradient across three existing tokens — `brand-100` →
`canvas-blue` → white — so it carries a hue without leaving the light scale. It
holds the eyebrow «لوحتي», the greeting «أهلًا بك، {name}», and one supporting
line.

Along its bottom sits one row of complete geometric stars (the _khatim_ frieze),
closed off by the panel's own border rather than a fade. It sits **below** the
text, never behind it.

The band renders **even when every data query fails**, because it greets the
student with a name the auth guard already returned — a failed load still
arrives on a page rather than on a bare error.

### 2. The stat strip — four tiles

| Tile           | Hue   | Icon           | Value                                |
| -------------- | ----- | -------------- | ------------------------------------ |
| دورات مفعّلة   | blue  | graduation cap | active course entitlements           |
| محاكيات مفعّلة | teal  | monitor        | active simulator entitlements        |
| محاولات مسجّلة | gold  | clipboard      | every attempt ever started           |
| أفضل نتيجة     | green | target         | best graded attempt, drawn as a ring |

Three rules govern this strip:

- **A brand-new student sees it too, zeros and all.** The zeros are the shape of
  the thing they are about to fill; a screen that only gains colour after a
  purchase is one nobody comes back to.
- **An ungraded account gets words, not a number.** The score reads «—» with «لا
  نتيجة بعد» — never `0%`, because zero is a result and the student has not got
  one.
- **Every figure is real.** No placeholder progress, no invented percentages.

The strip animates in with a 70 ms stagger so the four land as one gesture. It
is the only staggered entrance on the page, because it is the only content above
the fold; everything below reveals on scroll. Both collapse entirely under
`prefers-reduced-motion`.

### 3a. When the student owns nothing

Two blocks replace the lists:

- **«ابدأ من هنا»** — one clear invitation, with a card for courses and one for
  simulators.
- **The journey strip** — the four-step method (افهم · تدرّب · اختبر نفسك · ادخل
  الاختبار بثقة) in the _same four hues_ as the tiles above, so the colour
  vocabulary already means something by the time real content arrives.

Owning nothing at all is treated as one situation deserving one invitation —
not as three separate empty sections.

### 3b. When the student owns something

Three sections, each with a hued icon chip, a title, and a «عرض الكل» link:

1. **دوراتي** (blue) — owned courses
2. **محاكياتي** (teal) — owned simulators
3. **آخر المحاولات** (gold) — the three most recent attempts

The «عرض الكل» link stays brand blue in every section. Controls are exempt from
the colour code, so a gold link would read as a different _kind_ of navigation
rather than the same navigation in another chapter.

### 4. آخر الطلبات

Always present, in neutral, showing the three most recent orders.

---

## The record screens

### دوراتي / محاكياتي

A grid of cards, one per owned product. Each carries:

- A 3 px rule across its head in the product's own hue
- An icon chip, the title, and two badges — the product type and «الوصول متاح»
- The short description
- «تاريخ الوصول» — when access was granted
- Actions along the bottom

**The simulator card is the only one with two buttons**: «ابدأ المحاكاة», which
creates an attempt and moves the student to the instructions screen, and «فتح»,
which opens the product page. The course card has «فتح» alone.

Cards rest flat, with no hover lift. A card that rises but does not open would
promise a click it cannot honour — only the buttons inside it are interactive.

There is deliberately **no progress bar** here: the underlying record carries the
entitlement and the product and nothing about lessons completed, so a bar would
either be invented or need a query this component has no business making.

### محاولاتي

Each attempt shows its simulator, mode, status badge, dates, and — once graded —
the score as a green meter beside the percentage.

The meter is `aria-hidden`. The list immediately above it already states the
count, the total and the percentage in words and digits, so announcing the same
number again as a meter is noise rather than access. Nothing is carried by the
bar alone.

Results are always framed as **training indicators**, never an official score.

### طلباتي

One card per order: product title, amount in Saudi riyals, order date, a status
badge («مدفوع»), and the order id on a muted line.

The order id is Latin and therefore direction-isolated, so it cannot reorder the
Arabic around it. Amounts always pass through the shared money formatter — never
divided by 100 by hand.

### حسابي

A plain definition list: full name, email, phone (or «لم يُضف»), and the account
creation date.

**Read-only, and it says so.** A line beneath explains that editing is not yet
available and to get in touch — an honest absence rather than a disabled form
that looks like it might work.

---

## Content rules the whole area follows

1. **"Nothing here" and "we could not load this" are never the same thing.** A
   failed query renders a distinct error state; it never degrades into an empty
   list or a row of zeros. An outage shown as "you own no courses" reads as a
   fact about the student's account.
2. **On the overview, a failure replaces the whole block.** Every list comes from
   one round trip, so there is no partial truth worth showing.
3. **Every Arabic string comes from the central copy bank.** Nothing user-facing
   is typed inline in a component.
4. **Only active access is listed.** Revoked entitlements are excluded — these
   screens answer "what can I open right now", not "what did I once have".
5. **Latin content is direction-isolated** — emails, order ids, dates, amounts —
   so it cannot flip the Arabic around it.

---

## Deliberately absent

- Dark bands and any elevation scale
- Cards that lift, scale or glow under the cursor
- Charts, trend lines, or comparison against a previous period
- Invented progress indicators
- A `0%` score for a student who has never been graded

Depth on these screens is made of soft grounds, one hairline, and the masthead
gradient — all of it inside the light scale.

---

## One known limit

The best score scans the student's 500 most recent graded attempts. The ratio
`correct / total` is not a stored column, so the database can neither sort by it
nor aggregate it. A student past 500 graded attempts would see the best of their
most recent 500 — recorded here rather than left silent.
