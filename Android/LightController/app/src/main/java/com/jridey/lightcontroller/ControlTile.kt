package com.jridey.lightcontroller

import android.app.PendingIntent
import android.content.Intent
import android.service.controls.Control
import android.service.controls.ControlsProviderService
import android.service.controls.DeviceTypes
import android.service.controls.actions.BooleanAction
import android.service.controls.actions.ControlAction
import android.service.controls.templates.ControlButton
import android.service.controls.templates.ToggleTemplate
import android.util.Log
import android.widget.Toast
import androidx.annotation.RequiresApi
import java.util.concurrent.Flow
import java.util.function.Consumer

@RequiresApi(30)
class ControlTile : ControlsProviderService() {
    private val controlList: List<Control> get() {
        return arrayListOf(
            Control.StatefulBuilder(
                "Button",
                PendingIntent.getActivity(
                    this,
                    0,
                    Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT // setting the mutability flag
                )
            )
                .setTitle("Light")
                .setDeviceType(DeviceTypes.TYPE_LIGHT)
                .setControlId("light")
                .setStatus(Control.STATUS_OK)
                .setControlTemplate(ToggleTemplate("button", ControlButton(true, "button")))
                .build()
        )
    }

    override fun createPublisherForAllAvailable(): Flow.Publisher<Control> {
        return Flow.Publisher {
            for (control in controlList) {
                it.onNext(control)
            }
            it.onComplete()
        }
    }

    override fun performControlAction(
        controlId: String,
        action: ControlAction,
        consumer: Consumer<Int>
    ) {
        if (controlId == "light") {
            if (action is BooleanAction) {
                Thread { MainActivity.sendLightCommand() }.start()
            }
        }
        Log.d(
            "ControlTest",
            "performControlAction $controlId ${action.toString()} ${consumer.toString()}"
        )
        consumer.accept(ControlAction.RESPONSE_OK)
    }

    override fun createPublisherFor(controlIds: MutableList<String>): Flow.Publisher<Control> {
        Log.d("ControlTest", "publisherFor ${controlIds.toString()}")
        return Flow.Publisher {
            for (control in controlList) {
                if (!controlIds.contains(control.controlId)) continue

                Log.d("ControlTest", "Found ${control.controlId}")
                it.onSubscribe(object : Flow.Subscription {
                    override fun cancel() {
                        Log.d("ControlTest", "cancel")
                    }

                    override fun request(p0: Long) {
                        Log.d("ControlTest", "request $p0")
                    }

                })
                it.onNext(control)
            }
        }
    }
}