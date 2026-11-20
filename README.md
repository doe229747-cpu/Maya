# Maya Creative

Polskojęzyczna aplikacja webowa do rozmowy z Gemini i rozwijania pomysłów. Frontend
działa w React, a klucz Gemini pozostaje po stronie serwera Node.js. Historia
rozmów jest automatycznie zapisywana w `localStorage` przeglądarki i można ją
wyeksportować do pliku JSON.

## Google AI Studio

1. Otwórz [Google AI Studio Build](https://aistudio.google.com/apps).
2. Wybierz **Import from GitHub** i wskaż to repozytorium.
3. W ustawieniach aplikacji otwórz **Settings → Secrets**.
4. Upewnij się, że istnieje sekret `GEMINI_API_KEY`. AI Studio może dodać go
   automatycznie podczas tworzenia aplikacji korzystającej z Gemini.
5. Uruchom projekt; `npm run dev` startuje serwer i podgląd na porcie `3000`.

Nie kopiuj klucza do plików aplikacji ani zmiennych z prefiksem `VITE_`. Kod
przeglądarki nie powinien mieć dostępu do sekretu.

## Uruchomienie lokalne

Wymagane jest Node.js 22 lub nowsze.

```bash
npm install
cp .env.example .env
```

Utwórz klucz na [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
i wpisz go do `.env`:

```dotenv
GEMINI_API_KEY=twoj_klucz
```

Następnie:

```bash
npm run dev
```

Aplikacja będzie dostępna pod `http://localhost:3000`.

## Sprawdzenie i wersja produkcyjna

```bash
npm run check
npm run build
npm start
```

Status konfiguracji można sprawdzić pod `/api/health`. Endpoint zwraca
`configured: false`, gdy serwer nie ma klucza Gemini.

## Zapis danych

Rozmowy są zapisywane lokalnie w przeglądarce, więc działają bez Firebase i
Google Cloud. Dane nie są synchronizowane między urządzeniami. Można je pobrać
przy użyciu przycisku **Pobierz moje rozmowy**. Wyczyszczenie danych witryny w
przeglądarce usuwa historię.

## Debian 13 z pełnym GNOME w Dockerze

Repozytorium zawiera także osobny, trwały system **Debian 13 (trixie) z
`task-gnome-desktop`**. Dostęp do GNOME odbywa się przez przeglądarkę przy
pomocy TigerVNC i noVNC. To rozwiązenie nie przesyła do Gita pliku
wielkości 32 GB: przy pierwszym starciu Docker tworzy rzadki obraz ext4 o
pojemności 32 GB wewnątrz wolumenu `maya-system`. Obraz zajmuje początkowo
tylko wykorzystane miejsce i może rozrosnąć się do zadeklarowanych 32 GB.

Wymagania na komputerze-hoście:

- Docker Engine lub Docker Desktop z Docker Compose,
- około 12–15 GB wolnego miejsca na warstwę systemową i pakiety GNOME,
- dodatkowo do 32 GB na dane użytkownika,
- Linux z obsługą urządzeń loopback lub Docker Desktop używany w trybie
  uprzywilejowanym.

Uruchomienie:

```bash
docker compose -f docker-compose.gnome.yml up --build -d
```

Otwórz następnie:

```text
http://localhost:6080/vnc.html
```

Wpisz hasło `maya321`, a użytkownikiem systemu jest `maya`. Hasło można zmienić
przed pierwszym uruchomieniem:

```bash
VNC_PASSWORD=bezpieczne_haslo docker compose -f docker-compose.gnome.yml up --build -d
```

Sprawdzenie stanu:

```bash
docker compose -f docker-compose.gnome.yml ps
docker compose -f docker-compose.gnome.yml logs -f debian-gnome
```

Zatrzymanie bez usuwania dysku:

```bash
docker compose -f docker-compose.gnome.yml down
```

Pojemność widoczną w systemie można sprawdzić poleceniem `df -h /home/maya`.
Powinno to być około 32 GB. Struktura katalogów domowych i wszystkie zmiany
użytkownika zostają zachowane w wolumenie `maya-system`.

### Ważne ograniczenia

- Kontener działa w trybie `privileged`, ponieważ Debian montuje i formatuje
  własny obraz dysku 32 GB. Uruchamiaj go wyłącznie na zaufanym hoście.
- Interfejs noVNC jest publikowany tylko na `127.0.0.1`; nie wystawiaj go do
  internetu bez warstwy uwierzytelniania TLS.
- Debian, GNOME i katalog domowy są systemem przeznaczonym do pracy lokalnej.
  Aplikacja Maya nadal może działać równolegle lub osobno.
- Usunięcie wolumenu poleceniem `docker compose ... down -v` bezpowrotnie usuwa
  cały dysk 32 GB i jego dane.
