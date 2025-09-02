#!/usr/bin/env node
import fs from "fs";
import path from "path";
import selfsigned from "selfsigned";

const CERTS_DIR = path.resolve(process.cwd(), "certs");
if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR, { recursive: true });

const attrs = [{ name: "commonName", value: "localhost" }];
const pems = selfsigned.generate(attrs, {
  days: 365,
  keySize: 2048,
  algorithm: "sha256",
  extensions: [
    { name: "basicConstraints", cA: true },
    {
      name: "keyUsage",
      keyCertSign: true,
      digitalSignature: true,
      keyEncipherment: true,
    },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: "localhost" },
        { type: 7, ip: "127.0.0.1" },
      ],
    },
  ],
});

const serverKeyPath = path.join(CERTS_DIR, "server.key");
const serverCrtPath = path.join(CERTS_DIR, "server.crt");
fs.writeFileSync(serverKeyPath, pems.private, {
  encoding: "utf8",
  mode: 0o600,
});
fs.writeFileSync(serverCrtPath, pems.cert, { encoding: "utf8" });

console.log("Generated dev TLS certs:");
console.log("TLS_CERT_PATH=" + serverCrtPath);
console.log("TLS_KEY_PATH=" + serverKeyPath);
