//go:generate  go-bindata static/...
package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"time"
    "strings"

	assetfs "github.com/elazarl/go-bindata-assetfs"
	"github.com/gorilla/websocket"
    "github.com/go-redis/redis"
)

type livestatus struct {
    Host string `json:"host"`
    Addr string `json:"addr"`
    Rx   int    `json:"rx"`
    Tx   int    `json:"tx"`
}

type dashboard struct {
	clients map[string]livestatus
	wsclients map[string]*websocket.Conn
    rclient *redis.Client
}

func newDashboard() *dashboard {
    rclient := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	return &dashboard{
		wsclients: map[string]*websocket.Conn{},
        clients: map[string]livestatus{},
        rclient: rclient,
	}
}

func (d *dashboard) Poll() {
	log.Println("Starting data fetching")

	for ; ; time.Sleep(time.Second) {
        keys := d.rclient.Keys("traffic-live-*")
        for _, key := range keys.Val() {
            val, err := d.rclient.Get(key).Result()
            if err != nil {
                panic(err)
            }

            status := livestatus{}
            err = json.NewDecoder(strings.NewReader(val)).Decode(&status)
            if err != nil {
                log.Printf("error reading json response: %v", err)
                continue
            }

            d.clients[key] = status
        }

		d.broadcast(d.clients)
	}

}

func wspayload(conn *websocket.Conn, clients map[string]livestatus) error {
	log.Printf("[+] send clients to %s\n", conn.RemoteAddr())
	return conn.WriteJSON(clients)
}

func (d *dashboard) broadcast(data map[string]livestatus) {
	if len(d.wsclients) <= 0 {
		return
	}

	for _, conn := range d.wsclients {
		if err := wspayload(conn, data); err != nil {
			log.Printf("error sending clients to %s: %v", conn.RemoteAddr(), err)
			continue
		}
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func wshandler(dashboard *dashboard) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println(err)
			return
		}

		dashboard.wsclients[conn.RemoteAddr().String()] = conn
		log.Printf("[+] client connected %s\n", conn.RemoteAddr())

		for {
			if _, _, err := conn.NextReader(); err != nil {
				conn.Close()
				delete(dashboard.wsclients, conn.RemoteAddr().String())
				log.Printf("[+] client disconnected %s: %s\n", conn.RemoteAddr(), err)

				break
			}
		}
	}
}

var addr = flag.String("addr", ":8091", "http server address")

func main() {
	flag.Parse()
	dashboard := newDashboard()
	go dashboard.Poll()

	http.HandleFunc("/ws", wshandler(dashboard))
	http.Handle("/",
		http.FileServer(
			&assetfs.AssetFS{Asset: Asset, AssetDir: AssetDir, AssetInfo: AssetInfo, Prefix: "static"}))
	if err := http.ListenAndServe(*addr, nil); err != nil {
		log.Println(err)
	}
}
