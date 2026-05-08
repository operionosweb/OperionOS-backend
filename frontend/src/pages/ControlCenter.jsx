import React, { useEffect, useState } from "react";
import { socket } from "../lib/socket";

export default function ControlCenter() {

  const [fleet, setFleet] = useState([]);

  useEffect(() => {

    socket.on("fleet:init", (data) => {
      setFleet(data);
    });

    socket.on("fleet:update", (data) => {
      setFleet(data);
    });

  }, []);

  return (
    <div style={{ padding: 20 }}>

      <h2>🧠 Operion Live Control Center</h2>

      {fleet.map((a) => (
        <div key={a.id} style={{
          padding: 10,
          margin: 10,
          border: "1px solid #ccc"
        }}>

          <h3>{a.tail}</h3>
          <p>Model: {a.model}</p>

          <p>
            Failure Risk:
            <b style={{
              color: a.failure > 70 ? "red" : "black"
            }}>
              {a.failure.toFixed(1)}%
            </b>
          </p>

        </div>
      ))}

    </div>
  );
}
