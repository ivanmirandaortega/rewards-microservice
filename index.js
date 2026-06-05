const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4004;
const DATA_FILE = path.join(__dirname, 'rewards.json');

app.use(cors());
app.use(express.json());

function readData() {
	if (!fs.existsSync(DATA_FILE)) {
		return { balances: [], events: [] };
	}

	const raw = fs.readFileSync(DATA_FILE, 'utf8');
	const data = raw ? JSON.parse(raw) : {};

	return {
		balances: Array.isArray(data.balances) ? data.balances : [],
		events: Array.isArray(data.events) ? data.events : [],
	};
}

function saveData(data) {
	fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function findBalance(data, userId, appId) {
	return data.balances.find(
		(item) => item.userId === userId && item.appId === appId,
	);
}

function buildBalanceId(userId, appId) {
	return `${appId}:${userId}`;
}

function buildRewardEventId(checkInId) {
	return `reward:${checkInId}`;
}

app.get('/', (req, res) => {
	res.json({ message: 'rewards microservice is running' });
});

app.get('/api/rewards', (req, res) => {
	const { userId, appId } = req.query;
	const data = readData();

	if (!userId || !appId) {
		return res.status(400).json({ error: 'userId and appId are required' });
	}

	const balance = findBalance(data, userId, appId);

	return res.json({
		userId,
		appId,
		points: balance ? balance.points : 0,
		updatedAt: balance ? balance.updatedAt : null,
	});
});

app.get('/api/rewards/events', (req, res) => {
	const { userId, appId } = req.query;
	const data = readData();

	const events = data.events.filter((item) => {
		if (userId && item.userId !== userId) {
			return false;
		}

		if (appId && item.appId !== appId) {
			return false;
		}

		return true;
	});

	return res.json(events);
});

app.post('/api/rewards', (req, res) => {
	const { userId, appId, checkInId, points, reason } = req.body;

	if (!userId || !appId || !checkInId) {
		return res
			.status(400)
			.json({ error: 'userId, appId, and checkInId are required' });
	}

	const rewardPoints = Number(points ?? 10);

	if (!Number.isFinite(rewardPoints) || rewardPoints <= 0) {
		return res.status(400).json({ error: 'points must be a positive number' });
	}

	const data = readData();
	const existingEvent = data.events.find(
		(item) => item.checkInId === checkInId,
	);

	if (existingEvent) {
		const balance = findBalance(data, userId, appId);

		return res.status(200).json({
			rewardEvent: existingEvent,
			balance: {
				userId,
				appId,
				points: balance ? balance.points : 0,
				updatedAt: balance ? balance.updatedAt : null,
			},
			duplicate: true,
		});
	}

	const rewardEvent = {
		id: buildRewardEventId(checkInId),
		userId,
		appId,
		checkInId,
		points: rewardPoints,
		reason: reason || 'daily_check_in',
		createdAt: new Date().toISOString(),
	};

	data.events.push(rewardEvent);

	let balance = findBalance(data, userId, appId);

	if (!balance) {
		balance = {
			id: buildBalanceId(userId, appId),
			userId,
			appId,
			points: 0,
			updatedAt: new Date().toISOString(),
		};
		data.balances.push(balance);
	}

	balance.points += rewardPoints;
	balance.updatedAt = new Date().toISOString();

	saveData(data);

	return res.status(201).json({
		rewardEvent,
		balance,
		duplicate: false,
	});
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:4004`);
});
