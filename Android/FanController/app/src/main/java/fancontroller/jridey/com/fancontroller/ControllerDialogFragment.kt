package fancontroller.jridey.com.fancontroller

import android.app.AlertDialog
import android.app.Dialog
import android.app.DialogFragment
import android.os.Bundle
import android.view.WindowManager
import android.widget.EditText
import android.widget.ProgressBar

class ControllerDialogFragment : DialogFragment() {
    var callback: ((Dialog) -> Unit)? = null

    @Deprecated("Deprecated in Java")
    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val builder = AlertDialog.Builder(activity)
        val inflater = activity.layoutInflater
        val view = inflater.inflate(R.layout.dialog_controller_fragment, null)

        // Set the cursor to the end of the text
        val editText = view.findViewById<EditText>(R.id.controller_ip_address)
        editText.setSelection(editText.text.length)
        editText.requestFocus()

        builder.setView(view)
                .setPositiveButton(R.string.ok) { _, _ ->
                    // Callback is handled below to prevent dialog closing before response
                }
                .setNegativeButton(R.string.cancel) { _, _ ->
                    dialog.cancel()
                }

        // Bring up the keyboard automatically
        val alertDialog = builder.create()
        alertDialog.setOnShowListener {
            val button = (alertDialog as AlertDialog).getButton(AlertDialog.BUTTON_POSITIVE)
            button.setOnClickListener {
                dialog.findViewById<ProgressBar>(R.id.progress_bar).isIndeterminate = true
                callback?.invoke(dialog)
            }
        }

        alertDialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE)

        return alertDialog
    }
}