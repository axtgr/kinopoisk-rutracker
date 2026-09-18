// ==UserScript==
// @name         Kinopoisk RuTracker
// @namespace    http://tampermonkey.net/
// @version      0.2.2
// @description  Search movies and series from Kinopoisk on RuTracker and download them
// @author       axtgr
// @match        https://www.kinopoisk.ru/*
// @match        https://rutracker.org/*
// @icon         https://www.google.com/s2/favicons?domain=kinopoisk.ru
// @grant        GM.xmlHttpRequest
// @grant        GM.openInTab
// @grant        GM_openInTab
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.deleteValue
// @grant        GM.addValueChangeListener
// @grant        GM.removeValueChangeListener
// @connect      rutracker.org
// @connect      api.t-ru.org
// ==/UserScript==

(async () => {
	"use strict";

	const RUTRACKER_HOST = "https://rutracker.org";
	const MIN_SIZE_GB = 6;
	const MAX_SIZE_GB = 25;
	const SERIES_MIN_SIZE_GB = 3;
	const SERIES_MAX_SIZE_GB = 120;
	const SEARCH_REQUEST_KEY = "kr-search-request";
	const SEARCH_RESPONSE_KEY = "kr-search-response";
	const SEARCH_TAB_TIMEOUT_MS = 45000;
	const MOVIE_FORUM_IDS = new Set([
		// Movies
		22, 941, 1666, 376, 106,
		// Movies/Foreign
		7, 187, 2090, 2221, 2091, 2092, 2093, 2200, 1950, 252, 2540, 934, 505, 212,
		2459, 1235, 166, 2183, 209, 484,
		// Movies/Other
		124, 1543, 709, 1577,
		// TV/Other (theater)
		511, 1493,
		// Movies/DVD
		93, 905, 101, 100, 877, 1576, 572, 2220, 1670, 1900, 2258, 521,
		// Movies/HD
		2198, 2199, 313, 312, 1247, 2201, 2339, 140, 194, 2343, 930, 2365,
		// Movies/UHD
		718, 775, 1457, 1940, 272, 271, 84,
		// Movies/3D
		352, 549, 1213, 2109,
		// Movies (cartoons)
		4, 208, 539, 822, 181,
	]);
	const SERIES_FORUM_IDS = new Set([
		// TV (cartoon series)
		921, 815, 816, 1460, 498,
		// TV/Anime
		33, 1106, 1105, 599, 1389, 1391, 2491, 2544, 1642, 1390, 404, 1277,
		// TV (Russian series)
		9, 812, 81, 920, 80, 1535, 188, 91, 990, 1408, 175, 79, 104,
		// TV/Foreign
		189, 842, 235, 242, 819, 1531, 721, 1102, 1120, 1214, 489, 387, 1359, 184,
		1417, 1449, 504, 372, 110, 121, 507, 536, 1144, 195,
		// TV/HD
		2366, 1803, 266, 193, 1690, 1459, 1463, 825, 1248, 1288, 265, 2404, 2405,
		2370, 2396, 2398, 1498,
		// TV/UHD
		119, 1171, 1669, 2393, 625, 1949, 173, 273,
		// TV/Foreign (LatAm / Turkey / India)
		911, 325, 534, 594, 1301, 607, 1574, 1539, 694, 781, 704, 1537,
		// TV/Foreign (Asian series)
		2100, 820, 915, 1242, 717, 1939, 2412,
	]);
	const FORUM_IDS = new Set([...MOVIE_FORUM_IDS, ...SERIES_FORUM_IDS]);

	const STYLES = `
        #kinopoisk-rutracker-container {
            display: flex;
            align-items: center;
            margin: 20px 0;
            min-height: 44px;
            font: 14px/1.4 Graphik Kinopoisk LC Web,Arial,Tahoma,Verdana,sans-serif;
        }

        #kinopoisk-rutracker-select {
            width: 100%;
            height: 44px;
            padding: 0 13px;
            border: 0;
            border-radius: 52px 0 0 52px;
            font: 14px/1 Graphik Kinopoisk LC Web,Arial,Tahoma,Verdana,sans-serif;
        }

        .kinopoisk-rutracker-button {
            display: inline-block;
            box-sizing: border-box;
            height: 44px;
            padding: 13px 22px;
            color: #fff;
            text-decoration: none;
            border: 0;
            border-right: 1px solid rgba(255, 255, 255, 0.25);
            background: #f60 no-repeat 50% 50%;
            transition: background-color 0.12s;
        }

        .kinopoisk-rutracker-button:hover {
            background-color: rgb(240, 92, 0);
        }

        .kinopoisk-rutracker-button:last-child {
            padding-right: 32px;
            padding-left: 20px;
            border-right: 0;
            border-radius: 0 52px 52px 0;
        }

        .kinopoisk-rutracker-button_link {
            background-image: url("data:image/svg+xml,%3Csvg height='22' width='22' viewBox='0 0 141.732 151.732' style='fill:%23fff;stroke:%23fff;stroke-width:5;' xml:space='preserve' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M57.217 63.271 20.853 99.637c-4.612 4.608-7.15 10.738-7.15 17.259 0 6.524 2.541 12.653 7.151 17.261a24.265 24.265 0 0 0 17.259 7.15h.002c6.52 0 12.648-2.54 17.257-7.15L91.738 97.79c7.484-7.484 9.261-18.854 4.573-28.188l-7.984 7.985a14.193 14.193 0 0 1-3.831 12.957l-37.28 37.277-.026-.023a14.411 14.411 0 0 1-9.527 3.579c-3.768 0-7.295-1.453-9.937-4.092-2.681-2.68-4.13-6.259-4.093-10.078a14.449 14.449 0 0 1 3.584-9.39l-.021-.02.511-.515a6.86 6.86 0 0 1 .206-.211c.021-.021.043-.044.064-.062l.123-.125 36.364-36.366a14.07 14.07 0 0 1 10.008-4.144c.977 0 1.947.101 2.899.298l7.993-7.995a24.422 24.422 0 0 0-10.889-2.554 24.26 24.26 0 0 0-17.258 7.148m70.592-38.934c0-6.52-2.541-12.65-7.15-17.258-4.61-4.613-10.74-7.151-17.261-7.151a24.237 24.237 0 0 0-17.257 7.151L49.774 43.442c-7.479 7.478-9.26 18.84-4.585 28.17l7.646-7.646c-.877-4.368.358-8.964 3.315-12.356l-.021-.022.502-.507.201-.206.062-.06.126-.127 36.363-36.364a14.068 14.068 0 0 1 10.014-4.147c3.784 0 7.339 1.472 10.014 4.147 5.522 5.521 5.522 14.51 0 20.027L76.138 71.629l-.026-.026a14.411 14.411 0 0 1-9.526 3.581c-.951 0-1.891-.094-2.814-.278l-7.645 7.645a24.442 24.442 0 0 0 10.907 2.563c6.523 0 12.652-2.539 17.261-7.148l36.365-36.365c4.61-4.613 7.149-10.742 7.149-17.264'/%3E%3C/svg%3E");
        }

        .kinopoisk-rutracker-button_download {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 512 512'%3E%3Cpath style='fill:%23fff;fill-opacity:1;stroke:%23fff;stroke-width:20;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none' d='M181 646.362v150h-75l150 150 150-150h-75v-150H181z' transform='translate(0 -540.362)'/%3E%3C/svg%3E");
        }
    `;

	function bytesToGB(bytes) {
		return bytes / 2 ** 30;
	}

	function getTorrentUrlForResult(result) {
		return result.MagnetUri || result.DownloadLink || result.Link.replace('viewtopic.php', 'dl.php');
	}

	function getPageInfo() {
		let seasonMatch = location.pathname.match(
			/^\/series\/(\d+)\/season\/(\d+)\/?$/,
		);
		if (seasonMatch) {
			return {
				id: seasonMatch[1],
				type: "series",
				season: Number(seasonMatch[2]),
			};
		}

		let match = location.pathname.match(/^\/(film|series)\/(\d+)\/?$/);
		if (!match) return null;

		return {
			id: match[2],
			type: match[1] === "series" ? "series" : "film",
			season: null,
		};
	}

	function getFilmId() {
		let page = getPageInfo();
		return page ? page.id : null;
	}

	function getPageKey(page) {
		page = page || getPageInfo();
		if (!page) return "";
		return page.season ? `${page.id}-s${page.season}` : page.id;
	}

	function getFilmHeading() {
		let candidates = [
			...document.querySelectorAll("h1[itemprop=name]"),
			...document.querySelectorAll("h1"),
		];

		for (let heading of candidates) {
			if (heading.textContent.trim() && heading.getClientRects().length > 0) {
				return heading;
			}
		}

		return candidates[0] || null;
	}

	function removeUi() {
		let $container = document.getElementById("kinopoisk-rutracker-container");
		if ($container) $container.remove();
	}

	function findMountParent($heading) {
		let $parent = $heading.parentNode && $heading.parentNode.nextElementSibling;
		if (!$parent) return $heading.parentNode;

		if ($parent.tagName.toLowerCase() === "button") {
			$parent = $parent.nextElementSibling;
		}

		return $parent || $heading.parentNode;
	}

	function ensureContainer(filmId, pageKey) {
		injectStyles(STYLES);

		let id = filmId || getFilmId() || "";
		let key = pageKey || getPageKey() || id;
		let $heading = getFilmHeading();
		if (!$heading || !$heading.parentNode) return null;

		let $parent = findMountParent($heading);
		if (!$parent) return null;

		let $existing = document.getElementById("kinopoisk-rutracker-container");
		if ($existing && $existing.dataset.pageKey === key && $parent.contains($existing)) {
			return $existing;
		}

		removeUi();

		let $container = document.createElement("div");
		$container.id = "kinopoisk-rutracker-container";
		$container.dataset.filmId = id;
		$container.dataset.pageKey = key;
		$container.style.color = getComputedStyle($heading).color;
		$parent.prepend($container);

		// If there is a description, put it before our controls
		if ($parent.children[1] && $parent.children[1].tagName === "P") {
			$parent.prepend($parent.children[1]);
		}

		return $container;
	}

	function renderStatus(message, filmId, pageKey) {
		let $container = ensureContainer(filmId, pageKey);
		if (!$container) return;

		$container.replaceChildren();
		$container.textContent = message;
	}

	function render(results, filmId, pageKey) {
		let $container = ensureContainer(filmId, pageKey);
		if (!$container) return;

		$container.replaceChildren();

		if (results instanceof Error) {
			$container.textContent = results.message;
			return;
		}

		if (results.length === 0) {
			$container.textContent = "Результаты не найдены на RuTracker";
			return;
		}

		let $linkButton = document.createElement("a");
		$linkButton.classList.add(
			"kinopoisk-rutracker-button",
			"kinopoisk-rutracker-button_link",
		);
		$linkButton.title = "Открыть раздачу";

		let $downloadButton = document.createElement("a");
		$downloadButton.classList.add(
			"kinopoisk-rutracker-button",
			"kinopoisk-rutracker-button_download",
		);
		$downloadButton.title = "Скачать";

		let updateUIForResult = (result) => {
			let torrentUrl = getTorrentUrlForResult(result);
			$linkButton.href = result.Details;
			$downloadButton.href = torrentUrl;
		};

		let $select = document.createElement("select");
		$select.id = "kinopoisk-rutracker-select";
		$select.onchange = () => {
			let result = results[$select.value];
			updateUIForResult(result);
		};

		results.forEach((result, i) => {
			let $option = document.createElement("option");
			$option.value = i;
			$option.textContent = `(${bytesToGB(result.Size).toFixed(2)}gb, ${result.Seeders}s) ${result.Title}`;
			$select.appendChild($option);
		});

		updateUIForResult(results[0]);
		$container.prepend($downloadButton);
		$container.prepend($linkButton);
		$container.prepend($select);
	}

	function extractMovieFromLd(data) {
		if (!data) return null;
		if (Array.isArray(data)) {
			for (let item of data) {
				let movie = extractMovieFromLd(item);
				if (movie) return movie;
			}
			return null;
		}
		if (data["@graph"]) return extractMovieFromLd(data["@graph"]);

		let type = data["@type"];
		let types = Array.isArray(type) ? type : [type];
		if (
			types.some(
				(item) =>
					item === "Movie" ||
					item === "TVSeries" ||
					item === "TVSeason" ||
					item === "TVEpisode",
			)
		) {
			return data;
		}

		if (data.name && (data.url || data.alternateName || data.datePublished)) {
			return data;
		}

		return null;
	}

	function parseJsonLd() {
		for (let $dataScript of document.querySelectorAll(
			'script[type="application/ld+json"]',
		)) {
			try {
				let movie = extractMovieFromLd(JSON.parse($dataScript.textContent));
				if (movie && movie.name) return movie;
			} catch (e) {}
		}

		return null;
	}

	function extractYear(value) {
		if (!value) return "";
		let match = String(value).match(/(?:19|20)\d{2}/);
		return match ? match[0] : "";
	}

	function getJsonLdTypes(data) {
		let type = data && data["@type"];
		return Array.isArray(type) ? type : [type];
	}

	function isSeriesType(data) {
		return getJsonLdTypes(data).some(
			(item) =>
				item === "TVSeries" || item === "TVSeason" || item === "TVEpisode",
		);
	}

	function unwrapSeriesJson(json) {
		if (!json) return json;
		let types = getJsonLdTypes(json);
		if (!types.includes("TVSeason") && !types.includes("TVEpisode")) {
			return json;
		}

		let series = json.partOfSeries;
		if (!series || !series.name) return json;

		return {
			...json,
			name: series.name,
			alternateName: series.alternateName || json.alternateName,
			datePublished: series.datePublished || series.startDate || json.datePublished,
			startDate: series.startDate || json.startDate,
			url: series.url || json.url,
		};
	}

	function parseMovieDataFromDom($heading) {
		$heading = $heading || getFilmHeading();
		if (!$heading) return null;

		let nameNode = [...$heading.childNodes].find(
			(node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
		);
		let name = (nameNode ? nameNode.textContent : $heading.textContent)
			.replace(/\s*\((?:\d{4}|сериал).*$/i, "")
			.trim();
		if (!name) return null;

		let page = getPageInfo();
		let year = extractYear($heading.textContent);
		let $alternate = document.querySelector("[itemprop=alternativeHeadline]");

		return {
			name,
			alternateName: $alternate && $alternate.textContent.trim(),
			year,
			datePublished: year || undefined,
			isSeries:
				(page && page.type === "series") ||
				/сериал/i.test($heading.textContent),
			season: page && page.season,
		};
	}

	function jsonLdMatchesFilm(movie, filmId, $heading) {
		if (filmId && movie.url) {
			let url = String(movie.url);
			return (
				url.includes(`/film/${filmId}`) || url.includes(`/series/${filmId}`)
			);
		}

		return Boolean(
			$heading && movie.name && $heading.textContent.includes(movie.name),
		);
	}

	function headingMatchesDocumentTitle($heading) {
		if (!$heading) return false;

		let headingText = $heading.textContent.replace(/\s+/g, " ").trim();
		if (!headingText) return false;

		let titleHead = document.title.split(/\s+[—–|-]\s+/)[0].trim();
		if (!titleHead) return false;

		let titleName = titleHead.replace(/\s*\((?:\d{4}|сериал).*$/i, "").trim();
		let headingName = headingText.replace(/\s*\((?:\d{4}|сериал).*$/i, "").trim();

		return (
			(titleName.length > 1 && headingText.includes(titleName)) ||
			(headingName.length > 1 && titleHead.includes(headingName))
		);
	}

	function parseMovieData(filmId, $heading) {
		$heading = $heading || getFilmHeading();
		let json = unwrapSeriesJson(parseJsonLd());
		let page = getPageInfo();

		if (json && json.name && jsonLdMatchesFilm(json, filmId, $heading)) {
			let series = isSeriesType(json) || (page && page.type === "series");
			let year = series
				? extractYear(json.startDate) ||
					extractYear(json.datePublished) ||
					extractYear($heading && $heading.textContent)
				: extractYear(json.datePublished) ||
					extractYear(json.startDate) ||
					extractYear($heading && $heading.textContent);

			return {
				name: json.name,
				alternateName: json.alternateName,
				year,
				datePublished: year || json.datePublished,
				isSeries: series,
				season: page && page.season,
			};
		}

		return parseMovieDataFromDom($heading);
	}

	function injectStyles(styles) {
		if (document.getElementById("kinopoisk-rutracker-styles")) return;
		if (!document.head) return;

		let $style = document.createElement("style");
		$style.id = "kinopoisk-rutracker-styles";
		$style.textContent = styles;
		document.head.appendChild($style);
	}

	function gmRequest(url, options = {}) {
		let details = {
			method: "GET",
			url,
			...options,
		};

		if (url.startsWith(RUTRACKER_HOST)) {
			details.overrideMimeType = "text/html; charset=windows-1251";
			details.cookiePartition = { topLevelSite: RUTRACKER_HOST };
		}

		return GM.xmlHttpRequest(details);
	}

	function responseHtml(res) {
		return (res && (res.responseText || res.response)) || "";
	}

	function isReadyTrackerDocument(doc) {
		return Boolean(
			doc.querySelector("#tor-tbl") ||
				doc.querySelector("#logged-in-username") ||
				doc.querySelector("form#login-form-full"),
		);
	}

	function parseForumId(href) {
		if (!href) return null;
		let match = href.match(/[?&]f=(\d+)/);
		return match ? Number(match[1]) : null;
	}

	function parseTopicId(link) {
		let id = link.getAttribute("data-topic_id");
		if (id) return String(id);
		let href = link.getAttribute("href") || "";
		let match = href.match(/[?&]t=(\d+)/);
		return match ? match[1] : null;
	}

	function parseSearchResults(html) {
		let doc = new DOMParser().parseFromString(html, "text/html");

		if (!isReadyTrackerDocument(doc)) {
			let error = new Error("RuTracker anti-bot");
			error.name = "AntiBotError";
			throw error;
		}

		if (
			doc.querySelector("form#login-form-full") ||
			!doc.querySelector("#logged-in-username")
		) {
			throw new Error("Войдите в RuTracker в этом браузере");
		}

		let results = [];

		doc.querySelectorAll("table#tor-tbl > tbody > tr").forEach((row) => {
			if (!row.querySelector("td.tor-size > a.tr-dl")) return;

			let titleLink =
				row.querySelector("td.t-title-col > div.t-title > a.tLink") ||
				row.querySelector("a.tLink, a[data-topic_id]");
			if (!titleLink) return;

			let topicId = parseTopicId(titleLink);
			if (!topicId) return;

			let forumLink = row.querySelector("td.f-name-col a");
			let forumId = parseForumId(forumLink && forumLink.getAttribute("href"));

			let sizeCell = row.querySelector("td.tor-size");
			let size = Number(sizeCell && sizeCell.getAttribute("data-ts_text")) || 0;

			let seedersCell =
				row.querySelector("td.seedmed, b.seedmed") ||
				row.querySelector("td:nth-child(7)");
			let seeders = 0;
			if (seedersCell && !seedersCell.textContent.includes("дн")) {
				let seedersText = (
					seedersCell.querySelector("b") || seedersCell
				).textContent.trim();
				seeders = Number(seedersText) || 0;
			}

			let details = `${RUTRACKER_HOST}/forum/viewtopic.php?t=${topicId}`;

			results.push({
				TopicId: topicId,
				ForumId: forumId,
				Title: titleLink.textContent.trim(),
				Size: size,
				Seeders: seeders,
				Details: details,
				Tracker: "RuTracker",
				Link: details,
			});
		});

		return results;
	}

	function waitForTrackerPage(timeoutMs) {
		return new Promise((resolve, reject) => {
			if (isReadyTrackerDocument(document)) {
				resolve("ready");
				return;
			}

			let settled = false;
			let finish = (value, error) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				observer.disconnect();
				window.removeEventListener("pagehide", onPageHide);
				if (error) reject(error);
				else resolve(value);
			};

			let timer = setTimeout(() => {
				finish(
					null,
					new Error(
						"Не удалось пройти защиту RuTracker. Откройте rutracker.org и обновите страницу.",
					),
				);
			}, timeoutMs);

			let onPageHide = () => finish("navigated");
			let observer = new MutationObserver(() => {
				if (isReadyTrackerDocument(document)) finish("ready");
			});

			observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
			});
			window.addEventListener("pagehide", onPageHide);
		});
	}

	async function handleRuTrackerBackgroundTab() {
		let pending = await GM.getValue(SEARCH_REQUEST_KEY);
		if (!pending || !pending.requestId) return;
		if (Date.now() - pending.ts > SEARCH_TAB_TIMEOUT_MS + 5000) return;

		try {
			window.blur();
		} catch (e) {}

		try {
			let status = await waitForTrackerPage(SEARCH_TAB_TIMEOUT_MS);
			if (status !== "ready") return;

			let stillPending = await GM.getValue(SEARCH_REQUEST_KEY);
			if (!stillPending || stillPending.requestId !== pending.requestId) return;

			let results = parseSearchResults(document.documentElement.outerHTML);
			await GM.setValue(SEARCH_RESPONSE_KEY, {
				requestId: pending.requestId,
				results,
			});
			await GM.deleteValue(SEARCH_REQUEST_KEY);
		} catch (e) {
			if (e && e.name === "AntiBotError") return;

			let stillPending = await GM.getValue(SEARCH_REQUEST_KEY);
			if (!stillPending || stillPending.requestId !== pending.requestId) return;

			await GM.setValue(SEARCH_RESPONSE_KEY, {
				requestId: pending.requestId,
				error:
					e instanceof Error ? e.message : "Получен пустой ответ от RuTracker",
			});
		}
	}

	function waitForSearchResponse(requestId, timeoutMs) {
		return new Promise((resolve, reject) => {
			let listenerId;
			let interval;
			let settled = false;

			let cleanup = () => {
				clearTimeout(timer);
				clearInterval(interval);
				if (
					listenerId != null &&
					typeof GM.removeValueChangeListener === "function"
				) {
					GM.removeValueChangeListener(listenerId);
				}
			};

			let finish = (value, error) => {
				if (settled) return;
				settled = true;
				cleanup();
				if (error) reject(error);
				else resolve(value);
			};

			let accept = (value) => {
				if (!value || value.requestId !== requestId) return;
				finish(value);
			};

			let timer = setTimeout(() => {
				finish(
					null,
					new Error(
						"Не удалось пройти защиту RuTracker. Откройте rutracker.org и обновите страницу.",
					),
				);
			}, timeoutMs);

			if (typeof GM.addValueChangeListener === "function") {
				listenerId = GM.addValueChangeListener(
					SEARCH_RESPONSE_KEY,
					(_name, _oldValue, newValue) => {
						accept(newValue);
					},
				);
			}

			interval = setInterval(async () => {
				accept(await GM.getValue(SEARCH_RESPONSE_KEY));
			}, 400);
		});
	}

	function keepPageFocused() {
		let running = true;
		let tick = () => {
			if (!running) return;
			try {
				window.focus();
			} catch (e) {}
		};

		tick();
		let id = setInterval(tick, 50);

		return () => {
			running = false;
			clearInterval(id);
			tick();
		};
	}

	function openBackgroundTab(url) {
		let options = {
			active: false,
			loadInBackground: true,
			insert: true,
		};

		if (typeof GM.openInTab === "function") {
			return GM.openInTab(url, options);
		}

		if (typeof GM_openInTab === "function") {
			return GM_openInTab(url, options);
		}

		throw new Error("GM.openInTab is unavailable");
	}

	async function fetchTrackerHtmlViaTab(url) {
		let requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
		await GM.deleteValue(SEARCH_RESPONSE_KEY);

		let responsePromise = waitForSearchResponse(
			requestId,
			SEARCH_TAB_TIMEOUT_MS,
		);
		await GM.setValue(SEARCH_REQUEST_KEY, { requestId, ts: Date.now() });

		let releaseFocus = keepPageFocused();
		let tab = openBackgroundTab(url);

		try {
			return await responsePromise;
		} finally {
			try {
				tab.close();
			} catch (e) {}
			releaseFocus();
			await GM.deleteValue(SEARCH_REQUEST_KEY);
			await GM.deleteValue(SEARCH_RESPONSE_KEY);
		}
	}

	async function fetchSearchPayload(url, reportStatus) {
		console.log("Kinopoisk RuTracker: request", url);
		if (reportStatus) reportStatus("Запрос к RuTracker…");

		try {
			const res = await gmRequest(url);
			console.log("Kinopoisk RuTracker: response", res);
			if (reportStatus) reportStatus("Обработка ответа RuTracker…");

			let html = responseHtml(res);
			let ok = res.status ? res.status === 200 : res.statusText === "OK";

			if (ok && html) {
				try {
					return { results: parseSearchResults(html) };
				} catch (e) {
					if (!e || e.name !== "AntiBotError") throw e;
					console.log(
						"Kinopoisk RuTracker: XHR looks like anti-bot, opening helper tab",
					);
					if (reportStatus) {
						reportStatus("Обход защиты RuTracker, открываю вспомогательную вкладку…");
					}
				}
			} else {
				console.log("Kinopoisk RuTracker: empty XHR, opening helper tab");
				if (reportStatus) {
					reportStatus("Пустой ответ RuTracker, открываю вспомогательную вкладку…");
				}
			}
		} catch (e) {
			if (e instanceof Error && e.message.includes("Войдите в RuTracker")) {
				throw e;
			}
			console.log("Kinopoisk RuTracker: XHR failed, opening helper tab", e);
			if (reportStatus) {
				reportStatus("Ошибка запроса к RuTracker, открываю вспомогательную вкладку…");
			}
		}

		try {
			return await fetchTrackerHtmlViaTab(url);
		} catch (tabError) {
			console.log(
				"Kinopoisk RuTracker: tab search failed, retrying XHR",
				tabError,
			);
			if (reportStatus) reportStatus("Повторный запрос к RuTracker…");
			const res = await gmRequest(url);
			let html = responseHtml(res);
			if (html) {
				return { results: parseSearchResults(html) };
			}
			throw tabError;
		}
	}

	async function searchRuTracker(titleData, reportStatus) {
		let { name, alternateName, year, season, isSeries } = titleData;
		let query = [
			name,
			alternateName && alternateName !== name ? alternateName : "",
			year,
			season ? `сезон ${season}` : "",
		]
			.filter(Boolean)
			.join(" ");
		let forumIds = isSeries ? SERIES_FORUM_IDS : FORUM_IDS;
		let url = `${RUTRACKER_HOST}/forum/tracker.php?nm=${encodeURIComponent(query)}&o=10&s=2&f=${[...forumIds].join(",")}`;

		let payload = await fetchSearchPayload(url, reportStatus);
		if (payload.error) throw new Error(payload.error);

		return payload.results;
	}

	function titleMatchesSeason(title, season) {
		if (!season || !title) return false;
		let pattern = new RegExp(
			`(сезон(?:ы)?\\s*:?\\s*|\\bS)\\s*0*${season}\\b`,
			"i",
		);
		return pattern.test(title);
	}

	function normalizeResults(results, { isSeries, season } = {}) {
		let forumIds = isSeries ? SERIES_FORUM_IDS : FORUM_IDS;
		let minSize = isSeries ? SERIES_MIN_SIZE_GB : MIN_SIZE_GB;
		let maxSize = isSeries ? SERIES_MAX_SIZE_GB : MAX_SIZE_GB;

		return results
			.filter(
				(result) => result.ForumId == null || forumIds.has(result.ForumId),
			)
			.sort((a, b) => {
				let weightA = 0;
				let weightB = 0;

				let sizeA = bytesToGB(a.Size);
				let sizeB = bytesToGB(b.Size);

				if (sizeA >= minSize && sizeA <= maxSize) {
					weightA += 10;
				}

				if (sizeB >= minSize && sizeB <= maxSize) {
					weightB += 10;
				}

				if (titleMatchesSeason(a.Title, season)) {
					weightA += 5;
				}

				if (titleMatchesSeason(b.Title, season)) {
					weightB += 5;
				}

				if (a.Seeders > b.Seeders) {
					weightA += 1;
				} else if (b.Seeders > a.Seeders) {
					weightB += 1;
				}

				return weightB - weightA;
			});
	}

	let runGeneration = 0;

	function waitForFilmReady(filmId, generation, reportStatus, pageKey) {
		return new Promise((resolve) => {
			let observer;
			let timer;
			let poll;
			let statusShown = false;

			let cleanup = () => {
				clearTimeout(timer);
				clearInterval(poll);
				if (observer) observer.disconnect();
			};

			let isStale = () =>
				generation !== runGeneration || getPageKey() !== pageKey;

			let tryParse = () => {
				if (isStale()) {
					cleanup();
					resolve(null);
					return true;
				}

				let $heading = getFilmHeading();
				if (!$heading || !$heading.textContent.trim()) return false;

				if (!statusShown && reportStatus) {
					statusShown = true;
					reportStatus("Загрузка данных…");
				}

				let json = unwrapSeriesJson(parseJsonLd());
				let jsonReady = json && jsonLdMatchesFilm(json, filmId, $heading);
				if (!jsonReady && !headingMatchesDocumentTitle($heading)) return false;

				let movieData = parseMovieData(filmId, $heading);
				if (!movieData || !movieData.name) return false;

				cleanup();
				resolve(movieData);
				return true;
			};

			if (tryParse()) return;

			observer = new MutationObserver(() => {
				tryParse();
			});
			observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
				characterData: true,
			});
			poll = setInterval(tryParse, 250);

			timer = setTimeout(() => {
				if (isStale()) {
					cleanup();
					resolve(null);
					return;
				}

				cleanup();
				resolve(parseMovieData(filmId, getFilmHeading()));
			}, 20000);
		});
	}

	async function runOnFilmPage() {
		let page = getPageInfo();
		if (!page) {
			runGeneration += 1;
			removeUi();
			return;
		}

		let filmId = page.id;
		let pageKey = getPageKey(page);
		let existing = document.getElementById("kinopoisk-rutracker-container");
		if (existing && existing.dataset.pageKey === pageKey) return;

		let generation = ++runGeneration;
		removeUi();

		console.log("Kinopoisk RuTracker: running for", page.type, filmId);

		let reportStatus = (message) => {
			if (generation !== runGeneration || getPageKey() !== pageKey) return;
			renderStatus(message, filmId, pageKey);
		};

		reportStatus("Запуск…");

		let movieData = await waitForFilmReady(
			filmId,
			generation,
			reportStatus,
			pageKey,
		);
		if (generation !== runGeneration) return;

		if (!movieData) {
			console.log("Kinopoisk RuTracker: no movie data, quitting");
			if (getFilmHeading()) {
				render(
					new Error("Не удалось распарсить данные"),
					filmId,
					pageKey,
				);
			}
			return;
		}

		try {
			reportStatus("Поиск раздач на RuTracker…");
			const results = await searchRuTracker(movieData, reportStatus);
			if (generation !== runGeneration || getPageKey() !== pageKey) return;

			console.log("Kinopoisk RuTracker: results", results);

			const normalizedResults = normalizeResults(results, {
				isSeries: movieData.isSeries,
				season: movieData.season,
			});
			console.log("Kinopoisk RuTracker: normalized results", normalizedResults);

			render(normalizedResults, filmId, pageKey);
		} catch (e) {
			if (generation !== runGeneration || getPageKey() !== pageKey) return;

			console.log("Kinopoisk RuTracker: search failed", e);
			render(
				e instanceof Error ? e : new Error("Получен пустой ответ от RuTracker"),
				filmId,
				pageKey,
			);
		}
	}

	function watchKinopoiskNavigation() {
		let lastPathname = null;
		let scheduled = null;

		let checkUrlChange = () => {
			if (location.pathname === lastPathname) return;
			lastPathname = location.pathname;
			clearTimeout(scheduled);
			scheduled = setTimeout(runOnFilmPage, 50);
		};

		let wrapHistory = (method) => {
			try {
				let original = history[method];
				if (typeof original !== "function") return;

				history[method] = function (...args) {
					let result = original.apply(this, args);
					checkUrlChange();
					return result;
				};
			} catch (e) {}
		};

		wrapHistory("pushState");
		wrapHistory("replaceState");
		window.addEventListener("popstate", checkUrlChange);

		try {
			if (
				window.navigation &&
				typeof window.navigation.addEventListener === "function"
			) {
				window.navigation.addEventListener("navigate", checkUrlChange);
			}
		} catch (e) {}

		let observeTitle = () => {
			let $title = document.querySelector("title");
			if (!$title) return false;

			new MutationObserver(checkUrlChange).observe($title, {
				childList: true,
				characterData: true,
				subtree: true,
			});
			return true;
		};

		if (!observeTitle() && document.documentElement) {
			let headObserver = new MutationObserver(() => {
				if (observeTitle()) headObserver.disconnect();
			});
			headObserver.observe(document.documentElement, {
				childList: true,
				subtree: true,
			});
		}

		setInterval(checkUrlChange, 400);
		checkUrlChange();
	}

	console.log("Kinopoisk RuTracker: running");

	if (/(^|\.)rutracker\.org$/i.test(location.hostname)) {
		await handleRuTrackerBackgroundTab();
		return;
	}

	watchKinopoiskNavigation();
})();
