package com.jridey.lightcontroller

import android.content.Context
import android.content.SharedPreferences
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.net.*


class MainActivity : AppCompatActivity() {
    companion object {
        private var lightAddress: String? = null
        fun sendLightCommand(): Int {
            val json = "{\"command\":\"light\"}"

            val url = URL("http://$lightAddress/control")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 5000
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            conn.doOutput = true
            conn.doInput = true
            conn.requestMethod = "POST"

            val os = conn.outputStream
            os.write(json.toByteArray(charset("UTF-8")))
            os.close()

            val responseCode = conn.responseCode;
            conn.disconnect()

            return responseCode;
        }
    }

    private lateinit var preferences: SharedPreferences
    private lateinit var toggleLightButton: View
    private lateinit var findLightButton: View

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        preferences = getPreferences(Context.MODE_PRIVATE)
        findLightButton = findViewById(R.id.find_light_button)
        toggleLightButton = findViewById(R.id.toggle_light_button)

        findLightButton.setOnClickListener { findLight(it) }
        toggleLightButton.setOnClickListener { toggleLight(it) }

        val address = preferences.getString("address", "")
        if (address.orEmpty().isNotEmpty()) {
            lightAddress = address
            toggleLightButton.isEnabled = true
        }
    }

    private fun startUdpReceiver() {
        val socket = DatagramSocket(3312)
        socket.soTimeout = 1000
        val data = ByteArray("james_light_controller".length)
        val packet = DatagramPacket(data, data.size)

        for (i in 1..10) {
            try {
                Log.d("MainActivity", "Attempting to receive")
                socket.receive(packet)
                Log.d("MainActivity", data.toString())
                if (data.contentEquals("james_light_controller".toByteArray())) {
                    lightAddress = packet.address.hostAddress
                    break
                }
            } catch (e: SocketTimeoutException) {
                Log.d("MainActivity", "Socket timed out")
            } catch (e: Exception) {
                Log.e("MainActivity", "exception", e)
            }
        }
        socket.close()

        runOnUiThread {
            findLightButton.isEnabled = true
            lightAddress.let {
                toggleLightButton.isEnabled = true
                val editor = preferences.edit()
                editor.putString("address", lightAddress)
                editor.commit()
            }
            Toast.makeText(
                applicationContext,
                "Light controller address ${lightAddress?.let { "found" } ?: "not found"}",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun getBroadcastAddress(): InetAddress? {
        val wifi = getSystemService(WIFI_SERVICE) as WifiManager
        val dhcp = wifi.dhcpInfo        // handle null somehow
        val broadcast = dhcp.ipAddress and dhcp.netmask or dhcp.netmask.inv()
        val quads = ByteArray(4)
        for (k in 0..3) quads[k] = (broadcast shr k * 8).toByte()
        return InetAddress.getByAddress(quads)
    }

    private fun sendUdpBroadcast() {
        val socket = DatagramSocket()
        socket.broadcast = true
        socket.reuseAddress = true

        val b = 0xA5.toByte()
        val data = byteArrayOf(b, b, b, b)
        val packet = DatagramPacket(data, data.size, getBroadcastAddress(), 3311)

        socket.send(packet)
        socket.close()
    }

    private fun findLight(view: View) {
        view.isEnabled = false

        Thread { startUdpReceiver() }.start()
        Thread { sendUdpBroadcast() }.start()
    }

    private fun toggleLight(view: View) {
        view.isEnabled = false

        lightAddress?.let {
            Thread {
                val responseCode = sendLightCommand()
                runOnUiThread {
                    val previousTint = view.backgroundTintList
                    view.backgroundTintList =
                        if (responseCode == 200) ColorStateList.valueOf(Color.GREEN) else ColorStateList.valueOf(
                            Color.RED
                        )
                    Handler(Looper.getMainLooper()).postDelayed({
                        view.backgroundTintList = previousTint
                        view.isEnabled = true
                    }, 500)
                }
            }.start()
        }
    }
}