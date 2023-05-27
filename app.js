const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//login API for getting jwt token
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = "${username}"`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//states list API
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
  SELECT
    state_id AS stateId,
    state_name AS stateName,
    population 
  FROM 
    state;`;
  const statesList = await db.all(getAllStatesQuery);
  response.send(statesList);
});

//state detailes API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const StateDetailsQuery = `SELECT state_id AS stateId, state_name AS stateName, population FROM state WHERE state_id = ${stateId}`;
  const stateDetails = await db.get(StateDetailsQuery);
  response.send(stateDetails);
});

//Add district API
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
    INSERT INTO
        district (district_name, state_id, cases, cured, active, deaths)
    Values ("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
    `;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//Get district details API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const queryToGetDistrictDetails = `
    SELECT 
        district_id AS districtId,
        district_name AS districtName,
        state_id AS stateId,
        cases, 
        cured, 
        active, 
        deaths
    FROM
        district
    WHERE 
        district_id = ${districtId};
    `;
    const districtDetails = await db.get(queryToGetDistrictDetails);
    response.send(districtDetails);
  }
);

//Delete district API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
        district
    WHERE 
        district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictDetailsQuery = `
    UPDATE 
        district
    SET
     district_name = "${districtName}",
     state_id = ${stateId},
     cases = ${cases},
     cured = ${cured},
     active = ${active},
     deaths = ${deaths}
    WHERE
        district_id = ${districtId};
    `;
    await db.run(updateDistrictDetailsQuery);
    response.send("District Details Updated");
  }
);

//state stats API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM 
        district
    WHERE
        state_id = ${stateId}
    GROUP BY
        state_id;
    `;
    const stateStats = await db.get(getStateStatsQuery);
    response.send(stateStats);
  }
);

module.exports = app;
