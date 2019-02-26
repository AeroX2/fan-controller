package fancontroller.jridey.com.fancontroller

import android.annotation.SuppressLint
import android.app.TimePickerDialog
import android.content.Context
import android.content.DialogInterface
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.support.v7.app.AppCompatActivity
import android.util.Log
import android.view.View
import android.widget.*

import kotlinx.android.synthetic.main.activity_main.*
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import okhttp3.OkHttpClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.util.*
import kotlin.concurrent.schedule

class MainActivity : AppCompatActivity() {
    private val TAG = "MainActivity";

    private lateinit var retrofit: Retrofit;
    private fun getClient(url: String): Retrofit {
        if (::retrofit.isInitialized && retrofit.baseUrl().host().equals(url)) return retrofit

        val client = OkHttpClient.Builder()
//                .connectTimeout(1, TimeUnit.SECONDS)
//                .readTimeout(1, TimeUnit.SECONDS)
                .build()
        retrofit = Retrofit.Builder()
                .baseUrl("http://"+url)
                .addConverterFactory(GsonConverterFactory.create())
                .client(client)
                .build()

        return retrofit
    }

    private fun getServiceAPI() = retrofit.create(APIInterface::class.java)

    private val clickListener = View.OnClickListener { view ->
        if (!::retrofit.isInitialized) {
            Toast.makeText(applicationContext, "A fan controller has not been selected", Toast.LENGTH_SHORT).show()
            return@OnClickListener
        }

        var command = ""
        when (view.id) {
            R.id.light_button -> {
                command = "light"
            }
            R.id.off_button -> {
                command = "off"
            }
            R.id.low_button -> {
                command = "low"
            }
            R.id.medium_button -> {
                command = "medium"
            }
            R.id.high_button -> {
                command = "high"
            }
        }

        val model = ControlModel(command, timeout)
        getServiceAPI().control(model).enqueue(object : Callback<ResponseModel> {
            override fun onResponse(call: Call<ResponseModel>, response: Response<ResponseModel>) {
                Log.d(TAG, "Successfully sent $command to the controller")

                view.background.setColorFilter(Color.GREEN, PorterDuff.Mode.MULTIPLY)
                Timer().schedule(300) {
                    view.background.clearColorFilter()
                }
            }

            override fun onFailure(call: Call<ResponseModel>, t: Throwable) {
                Log.e(TAG, t.message)
                Toast.makeText(applicationContext, "Failed to contact fan controller", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private var timeout: TimeoutModel? = null
    private val openTimepicker = View.OnClickListener { view ->
        val dialog = TimePickerDialog(this, TimePickerDialog.OnTimeSetListener { _, hour, minute ->
            timeout = TimeoutModel(hour, minute, 0)
        }, 0, 0, true)
        dialog.setOnDismissListener(DialogInterface.OnDismissListener {
            timeout = null
        })
        dialog.show();
    }

    @SuppressLint("SetTextI18n")
    private val addNewController = View.OnClickListener { view ->
        val dialog = ControllerDialogFragment()
        dialog.callback = { d ->
            val editText = d.findViewById<EditText>(R.id.controller_ip_address)
            val progressBar = d.findViewById<ProgressBar>(R.id.progress_bar)
            val errorTextView = d.findViewById<TextView>(R.id.error_message)

            val urlAddress = editText.text.toString()
            getClient(urlAddress)

            errorTextView.text = ""
            progressBar.isIndeterminate = true

            getServiceAPI().root().enqueue(object : Callback<ResponseModel> {
                override fun onResponse(call: Call<ResponseModel>, response: Response<ResponseModel>) {

                    if (!response.body()?.response.equals("James's Fan controller")) {
                        Log.d(TAG, response.body()?.response)
                        progressBar.isIndeterminate = false
                        errorTextView.text = "This is not a fan controller address"
                        return
                    }

                    fanControllers.add(urlAddress)
                    spinnerAdapter.notifyDataSetChanged();
                    spinner.setSelection(spinner.count)

                    val sharedPref = getPreferences(Context.MODE_PRIVATE)
                    with (sharedPref.edit()) {
                        putStringSet("fan_controller", fanControllers.toHashSet())
                        apply()
                    }

                    d.cancel()
                }

                override fun onFailure(call: Call<ResponseModel>, t: Throwable) {
                    Log.d(TAG, t.message)
                    progressBar.isIndeterminate = false
                    errorTextView.text = "Unable to contact fan controller"
                }
            })
        }
        dialog.show(fragmentManager, "ControllerDialogFragment")
    }


    val fanControllerSelected = object : AdapterView.OnItemSelectedListener {
        override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) {
            getClient(fanControllers.get(position))
        }

        override fun onNothingSelected(parent: AdapterView<*>?) {
        }

    }

    private lateinit var spinner: Spinner
    private val fanControllers = ArrayList<String>()
    private lateinit var spinnerAdapter: ArrayAdapter<String>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        setSupportActionBar(toolbar)

        findViewById<Button>(R.id.light_button).setOnClickListener(clickListener)
        findViewById<Button>(R.id.off_button).setOnClickListener(clickListener)
        findViewById<Button>(R.id.low_button).setOnClickListener(clickListener)
        findViewById<Button>(R.id.medium_button).setOnClickListener(clickListener)
        findViewById<Button>(R.id.high_button).setOnClickListener(clickListener)

        findViewById<Button>(R.id.timeout_button).setOnClickListener(openTimepicker)

        findViewById<ImageButton>(R.id.add_controller).setOnClickListener(addNewController)

        val sharedPref = getPreferences(Context.MODE_PRIVATE)
        fanControllers.addAll(sharedPref.getStringSet("fan_controller", HashSet()))
        spinnerAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, fanControllers)
        if (fanControllers.size > 0) getClient(fanControllers.get(0))

        spinner = findViewById(R.id.controller_spinner)
        spinner.adapter = spinnerAdapter
        spinner.onItemSelectedListener = fanControllerSelected
    }
}
